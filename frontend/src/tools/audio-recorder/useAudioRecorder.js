import { computed, ref } from 'vue'

import { resolvePreset } from './recorderPresets'

// Browser-only capture via MediaRecorder + a Web Audio analyser (drives both the level meter and
// the live waveform). Construction only creates refs (safe under SSR/jsdom); the browser APIs are
// touched in start(). Not unit-tested — it needs a real microphone — so it is kept defensive and
// always cleans up its stream/context.
//
// Toolbox stores nothing on the server, so a recording lives in this tab until the visitor saves
// it. Two consequences shape this module:
//
//   1. Memory is the ceiling. A tab that accumulates chunks without a limit gets killed on mobile,
//      losing the recording it was protecting. `start` therefore stops at MAX_DURATION_SECONDS or
//      MAX_BYTES, whichever arrives first, and reports which one through `limitReached`.
//   2. A file sink lifts the ceiling. When the caller passes a FileSystemWritableFileStream, each
//      chunk is written straight to the visitor's disk and never retained, so neither limit
//      applies and a crash cannot lose what is already written.

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]

// Time-domain sample count read from the analyser; the view sizes its waveform buffer to match.
export const WAVEFORM_SIZE = 1024

// The container this browser will actually record in. The disk-sink path needs it *before* the
// capture starts, so it can name the file with the right extension.
export function pickSupportedMime(scope = globalThis) {
  const supported = scope?.MediaRecorder?.isTypeSupported
  if (!supported) return ''
  return MIME_CANDIDATES.find((candidate) => supported(candidate)) || ''
}

// Ten minutes of Opus is about 2.4 MB and of WAV about 53 MB, so the duration limit binds first
// for voice. The byte limit is the backstop for a browser that ignores the bitrate hint.
export const MAX_DURATION_SECONDS = 600
export const MAX_BYTES = 100 * 1024 * 1024

export function useAudioRecorder({
  maxDurationSeconds = MAX_DURATION_SECONDS,
  maxBytes = MAX_BYTES,
} = {}) {
  const state = ref('idle') // idle | recording | paused | stopped
  const elapsed = ref(0) // seconds
  const level = ref(0) // 0..1 input level
  const error = ref('')
  const blob = ref(null)
  const url = ref('')
  const mimeType = ref('')
  const inputDevices = ref([]) // { deviceId, label }
  const bytes = ref(0)
  const limitReached = ref('') // '' | 'duration' | 'size'
  const isStreamingToDisk = ref(false)

  const isSupported = computed(
    () =>
      typeof window !== 'undefined' &&
      !!navigator?.mediaDevices?.getUserMedia &&
      typeof window.MediaRecorder !== 'undefined',
  )
  const durationSeconds = computed(() => elapsed.value)
  // Seconds left before the duration limit stops the capture. Infinite while streaming to disk,
  // so the view can hide the countdown rather than show a number that never falls.
  const remainingSeconds = computed(() =>
    isStreamingToDisk.value ? Number.POSITIVE_INFINITY : Math.max(0, maxDurationSeconds - elapsed.value),
  )

  let recorder = null
  let stream = null
  let chunks = []
  let audioContext = null
  let analyser = null
  let rafId = null
  let timerId = null
  let startedAt = 0
  let accumulated = 0
  let fileSink = null
  let sinkQueue = Promise.resolve()

  // Enumerate audio inputs. Device labels only appear once the user has granted permission, so
  // this is called both on mount (ids only) and again after the first successful capture.
  async function refreshDevices() {
    if (!navigator?.mediaDevices?.enumerateDevices) return
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      inputDevices.value = all
        .filter((device) => device.kind === 'audioinput' && device.deviceId)
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${index + 1}`,
        }))
    } catch {
      // Enumeration is optional; the default microphone still works.
    }
  }

  // `sink` is an open FileSystemWritableFileStream. Pass one to write straight to the visitor's
  // disk: chunks are not kept in memory, and neither limit applies.
  async function start({ deviceId = '', presetId = '', sink = null } = {}) {
    if (!isSupported.value) {
      error.value = 'Recording is not supported in this browser.'
      return false
    }
    error.value = ''
    limitReached.value = ''
    const preset = resolvePreset(presetId)
    const audioConstraints = { channelCount: preset.channelCount }
    if (deviceId) audioConstraints.deviceId = { exact: deviceId }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
    } catch (err) {
      error.value =
        err?.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow it in your browser to record.'
          : 'Could not access a microphone.'
      return false
    }
    // Labels are available now that permission is granted.
    void refreshDevices()

    _revoke()
    blob.value = null
    chunks = []
    bytes.value = 0
    fileSink = sink
    sinkQueue = Promise.resolve()
    isStreamingToDisk.value = Boolean(sink)
    mimeType.value = _pickMime()
    const options = {}
    if (mimeType.value) options.mimeType = mimeType.value
    if (preset.audioBitsPerSecond) options.audioBitsPerSecond = preset.audioBitsPerSecond
    recorder = new window.MediaRecorder(stream, options)
    recorder.ondataavailable = (event) => {
      if (!event.data || !event.data.size) return
      bytes.value += event.data.size
      if (fileSink) {
        // Serialise the writes: a FileSystemWritableFileStream rejects a second write while one
        // is in flight, and MediaRecorder does not wait for us. The chain swallows its own
        // rejection so a failed write never surfaces as an unhandled rejection, and `fileSink`
        // stays set so _finalize still closes the file and takes the disk branch — dropping to
        // the memory branch would show a 0-byte preview, because nothing was ever buffered.
        sinkQueue = sinkQueue
          .then(() => fileSink.write(event.data))
          .catch(() => {
            error.value = 'Writing to the chosen file failed, so recording stopped.'
            if (recorder && recorder.state !== 'inactive') recorder.stop()
          })
        return
      }
      chunks.push(event.data)
      if (bytes.value >= maxBytes) _stopAtLimit('size')
    }
    recorder.onstop = _finalize
    // A timeslice makes ondataavailable fire during the capture rather than once at the end, which
    // is what lets the byte limit and the disk sink work at all.
    recorder.start(1000)

    _startMeter()
    accumulated = 0
    startedAt = _now()
    _startTimer()
    state.value = 'recording'
    return true
  }

  function pause() {
    if (recorder && state.value === 'recording') {
      recorder.pause()
      accumulated += _now() - startedAt
      _stopTimer()
      state.value = 'paused'
    }
  }

  function resume() {
    if (recorder && state.value === 'paused') {
      recorder.resume()
      startedAt = _now()
      _startTimer()
      state.value = 'recording'
    }
  }

  function stop() {
    if (recorder && (state.value === 'recording' || state.value === 'paused')) {
      if (state.value === 'recording') accumulated += _now() - startedAt
      _stopTimer()
      _stopMeter()
      recorder.stop() // triggers _finalize
      state.value = 'stopped'
    }
  }

  // Discard an in-progress or finished recording and release everything.
  function reset() {
    if (recorder) recorder.onstop = null
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop()
    } catch {
      // ignore
    }
    _stopTimer()
    _stopMeter()
    _releaseStream()
    _revoke()
    if (fileSink) {
      const sink = fileSink
      fileSink = null
      sinkQueue = sinkQueue.then(() => sink.close()).catch(() => {})
    }
    recorder = null
    chunks = []
    blob.value = null
    elapsed.value = 0
    level.value = 0
    bytes.value = 0
    limitReached.value = ''
    isStreamingToDisk.value = false
    state.value = 'idle'
  }

  // Copy the latest time-domain samples into a caller-owned Uint8Array (length WAVEFORM_SIZE).
  // Returns false when no analyser is active so the view can skip drawing.
  function readWaveform(out) {
    if (!analyser || !out) return false
    analyser.getByteTimeDomainData(out)
    return true
  }

  // Stop because a limit was hit, keeping what was captured. The view reads `limitReached` to say
  // why the capture ended rather than leaving it look like a spontaneous stop.
  function _stopAtLimit(reason) {
    if (state.value !== 'recording' && state.value !== 'paused') return
    limitReached.value = reason
    stop()
  }

  function _finalize() {
    _stopMeter()
    _releaseStream()
    if (fileSink) {
      // The audio is already on disk. Close the file and keep nothing in memory.
      const sink = fileSink
      fileSink = null
      sinkQueue = sinkQueue.then(() => sink.close()).catch(() => {})
      return
    }
    const type = mimeType.value || (chunks[0] && chunks[0].type) || 'audio/webm'
    blob.value = new Blob(chunks, { type })
    _revoke()
    url.value = URL.createObjectURL(blob.value)
  }

  function _pickMime() {
    return pickSupportedMime(window)
  }

  function _startTimer() {
    _stopTimer()
    timerId = setInterval(() => {
      elapsed.value = (accumulated + (_now() - startedAt)) / 1000
      // The disk sink has no ceiling to enforce, so the clock only runs out in memory mode.
      if (!fileSink && elapsed.value >= maxDurationSeconds) _stopAtLimit('duration')
    }, 200)
  }

  function _stopTimer() {
    if (timerId) clearInterval(timerId)
    timerId = null
  }

  function _startMeter() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      audioContext = new Ctx()
      const source = audioContext.createMediaStreamSource(stream)
      analyser = audioContext.createAnalyser()
      analyser.fftSize = WAVEFORM_SIZE
      source.connect(analyser)
      const buffer = new Uint8Array(analyser.fftSize)
      const tick = () => {
        analyser.getByteTimeDomainData(buffer)
        let sum = 0
        for (const value of buffer) {
          const centred = (value - 128) / 128
          sum += centred * centred
        }
        level.value = Math.min(1, Math.sqrt(sum / buffer.length) * 2.5)
        rafId = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      // The meter/waveform is optional; recording continues without it.
    }
  }

  function _stopMeter() {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = null
    if (audioContext) {
      audioContext.close().catch(() => {})
      audioContext = null
    }
    analyser = null
    level.value = 0
  }

  function _releaseStream() {
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      stream = null
    }
  }

  function _revoke() {
    if (url.value) {
      URL.revokeObjectURL(url.value)
      url.value = ''
    }
  }

  function _now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now()
  }

  return {
    state,
    elapsed,
    level,
    error,
    blob,
    url,
    mimeType,
    inputDevices,
    bytes,
    limitReached,
    isStreamingToDisk,
    isSupported,
    durationSeconds,
    remainingSeconds,
    refreshDevices,
    readWaveform,
    start,
    pause,
    resume,
    stop,
    reset,
  }
}
