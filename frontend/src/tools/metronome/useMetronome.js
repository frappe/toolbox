import { ref } from 'vue'

import { advanceBeats, clampBpm } from './metronome'

// How often the scheduler wakes, and how far ahead it schedules clicks. This lookahead pattern
// keeps timing accurate even when the main thread is busy (setInterval alone would drift).
const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD_S = 0.12
const CLICK_SECONDS = 0.05

// A precise Web Audio metronome. Clicks are scheduled ahead on the audio clock; a rAF loop flips
// the visible beat exactly when each scheduled click sounds. The AudioContext is injected in tests.
export function useMetronome({ createContext = defaultCreateContext } = {}) {
  const isPlaying = ref(false)
  const isSupported = ref(defaultIsSupported())
  const currentBeat = ref(-1) // -1 while stopped

  let context = null
  let schedulerId = null
  let rafId = null
  let schedule = { nextNoteTime: 0, beatInMeasure: 0 }
  const visualQueue = []

  const settings = { bpm: 120, beatsPerMeasure: 4, volume: 0.5 }

  function start() {
    if (isPlaying.value) return
    context = context || createContext()
    if (!context) {
      isSupported.value = false
      return
    }
    context.resume?.()
    schedule = { nextNoteTime: (context.currentTime ?? 0) + 0.1, beatInMeasure: 0 }
    visualQueue.length = 0
    currentBeat.value = -1
    schedulerId = globalThis.setInterval(runScheduler, LOOKAHEAD_MS)
    runVisual()
    isPlaying.value = true
  }

  function stop() {
    if (!isPlaying.value) return
    if (schedulerId) globalThis.clearInterval(schedulerId)
    if (rafId && globalThis.cancelAnimationFrame) globalThis.cancelAnimationFrame(rafId)
    schedulerId = null
    rafId = null
    visualQueue.length = 0
    currentBeat.value = -1
    isPlaying.value = false
  }

  function runScheduler() {
    const until = (context.currentTime ?? 0) + SCHEDULE_AHEAD_S
    const { beats, state } = advanceBeats(schedule, until, settings.bpm, settings.beatsPerMeasure)
    schedule = state
    for (const beat of beats) {
      scheduleClick(beat.time, beat.accent)
      visualQueue.push(beat)
    }
  }

  function scheduleClick(time, accent) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = accent ? 1500 : 1000
    gain.gain.setValueAtTime?.(settings.volume, time)
    gain.gain.exponentialRampToValueAtTime?.(0.0001, time + CLICK_SECONDS)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(time)
    oscillator.stop(time + CLICK_SECONDS + 0.01)
  }

  function runVisual() {
    const now = context?.currentTime ?? 0
    while (visualQueue.length && visualQueue[0].time <= now) currentBeat.value = visualQueue.shift().beat
    if (globalThis.requestAnimationFrame) rafId = globalThis.requestAnimationFrame(runVisual)
  }

  function setBpm(value) {
    settings.bpm = clampBpm(value)
  }

  function setBeatsPerMeasure(value) {
    settings.beatsPerMeasure = Math.max(1, Math.min(12, Math.round(Number(value)) || 4))
  }

  function setVolume(value) {
    const volume = Number(value)
    settings.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : settings.volume
  }

  function dispose() {
    stop()
    context?.close?.()
    context = null
  }

  return { isPlaying, isSupported, currentBeat, start, stop, setBpm, setBeatsPerMeasure, setVolume, dispose }
}

function defaultIsSupported() {
  return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext)
}

function defaultCreateContext() {
  const Ctx = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null
  return Ctx ? new Ctx() : null
}
