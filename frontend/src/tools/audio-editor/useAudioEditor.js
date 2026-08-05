import { computed, ref, shallowRef } from 'vue'

import { computePeaks, defaultProject, MAX_HISTORY, renderEdit, renderedDuration } from './audioEdit'
import { encodeWav } from './wavEncode'

const WAVEFORM_BUCKETS = 800

// Owns a single-track, non-destructive edit session: decode a file to planar audio, hold the edit
// project, support bounded undo/redo, and render the current edit to a WAV Blob. Decoding is the
// only browser dependency and is injected so the rest is unit-testable.
export function useAudioEditor({ decode = decodeArrayBuffer } = {}) {
  const source = shallowRef(null) // { channels, sampleRate, duration, name }
  const project = ref(null)
  const state = ref('empty') // empty | decoding | ready | error
  const error = ref('')
  const peaks = shallowRef(new Float32Array(0))

  const past = []
  const future = []
  const historyVersion = ref(0) // bumped so canUndo/canRedo stay reactive

  const isReady = computed(() => state.value === 'ready')
  const outputDuration = computed(() =>
    source.value && project.value ? renderedDuration(source.value, project.value) : 0,
  )
  const canUndo = computed(() => historyVersion.value >= 0 && past.length > 0)
  const canRedo = computed(() => historyVersion.value >= 0 && future.length > 0)

  async function load(file) {
    state.value = 'decoding'
    error.value = ''
    try {
      const decoded = await decode(await file.arrayBuffer())
      source.value = { ...decoded, name: file.name || 'audio' }
      project.value = defaultProject(decoded.duration)
      peaks.value = computePeaks(decoded.channels, WAVEFORM_BUCKETS)
      _clearHistory()
      state.value = 'ready'
      return true
    } catch {
      state.value = 'error'
      error.value = 'This file could not be decoded. Try a common audio format such as WAV, MP3 or OGG.'
      return false
    }
  }

  // Commit an edit to the project, pushing the previous state onto the undo stack.
  function update(patch) {
    if (!project.value) return
    past.push({ ...project.value })
    if (past.length > MAX_HISTORY) past.shift()
    future.length = 0
    project.value = { ...project.value, ...patch }
    historyVersion.value += 1
  }

  function undo() {
    if (!past.length) return
    future.push({ ...project.value })
    project.value = past.pop()
    historyVersion.value += 1
  }

  function redo() {
    if (!future.length) return
    past.push({ ...project.value })
    project.value = future.pop()
    historyVersion.value += 1
  }

  // Render the current edit to a WAV Blob (used for preview playback and for saving/downloading).
  function renderBlob() {
    if (!source.value || !project.value) return null
    const rendered = renderEdit(source.value, project.value)
    return new Blob([encodeWav(rendered)], { type: 'audio/wav' })
  }

  function reset() {
    source.value = null
    project.value = null
    peaks.value = new Float32Array(0)
    state.value = 'empty'
    error.value = ''
    _clearHistory()
  }

  function _clearHistory() {
    past.length = 0
    future.length = 0
    historyVersion.value += 1
  }

  return {
    source,
    project,
    state,
    error,
    peaks,
    isReady,
    outputDuration,
    canUndo,
    canRedo,
    load,
    update,
    undo,
    redo,
    renderBlob,
    reset,
  }
}

// Decode an ArrayBuffer to planar Float32 channels via Web Audio (browser only). The channel data
// is copied out so it survives the AudioContext being closed.
async function decodeArrayBuffer(arrayBuffer) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  const context = new Ctx()
  try {
    const audioBuffer = await context.decodeAudioData(arrayBuffer)
    const channels = []
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      channels.push(audioBuffer.getChannelData(channel).slice())
    }
    return { channels, sampleRate: audioBuffer.sampleRate, duration: audioBuffer.duration }
  } finally {
    context.close?.()
  }
}
