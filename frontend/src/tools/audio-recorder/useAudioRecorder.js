import { computed, ref } from 'vue'

// Browser-only capture via MediaRecorder + a Web Audio level meter. Construction only creates
// refs (safe under SSR/jsdom); the browser APIs are touched in start(). Not unit-tested — it
// needs a real microphone — so it is kept defensive and always cleans up its stream/context.

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]

export function useAudioRecorder() {
  const state = ref('idle') // idle | recording | paused | stopped
  const elapsed = ref(0) // seconds
  const level = ref(0) // 0..1 input level
  const error = ref('')
  const blob = ref(null)
  const url = ref('')
  const mimeType = ref('')

  const isSupported = computed(
    () =>
      typeof window !== 'undefined' &&
      !!navigator?.mediaDevices?.getUserMedia &&
      typeof window.MediaRecorder !== 'undefined',
  )
  const durationSeconds = computed(() => elapsed.value)

  let recorder = null
  let stream = null
  let chunks = []
  let audioContext = null
  let rafId = null
  let timerId = null
  let startedAt = 0
  let accumulated = 0

  async function start() {
    if (!isSupported.value) {
      error.value = 'Recording is not supported in this browser.'
      return false
    }
    error.value = ''
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      error.value =
        err?.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow it in your browser to record.'
          : 'Could not access a microphone.'
      return false
    }

    _revoke()
    blob.value = null
    chunks = []
    mimeType.value = _pickMime()
    recorder = mimeType.value
      ? new window.MediaRecorder(stream, { mimeType: mimeType.value })
      : new window.MediaRecorder(stream)
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size) chunks.push(event.data)
    }
    recorder.onstop = _finalize
    recorder.start()

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
    recorder = null
    chunks = []
    blob.value = null
    elapsed.value = 0
    level.value = 0
    state.value = 'idle'
  }

  function _finalize() {
    const type = mimeType.value || (chunks[0] && chunks[0].type) || 'audio/webm'
    blob.value = new Blob(chunks, { type })
    _revoke()
    url.value = URL.createObjectURL(blob.value)
    _stopMeter()
    _releaseStream()
  }

  function _pickMime() {
    const supported = window.MediaRecorder.isTypeSupported
    if (!supported) return ''
    return MIME_CANDIDATES.find((m) => supported(m)) || ''
  }

  function _startTimer() {
    _stopTimer()
    timerId = setInterval(() => {
      elapsed.value = (accumulated + (_now() - startedAt)) / 1000
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
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      const buffer = new Uint8Array(analyser.frequencyBinCount)
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
      // The meter is optional; recording continues without it.
    }
  }

  function _stopMeter() {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = null
    if (audioContext) {
      audioContext.close().catch(() => {})
      audioContext = null
    }
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
    isSupported,
    durationSeconds,
    start,
    pause,
    resume,
    stop,
    reset,
  }
}
