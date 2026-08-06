import { ref } from 'vue'

import { clampFrequency } from './tones'

const RAMP_SECONDS = 0.02 // short gain ramp so start/stop and volume changes never click

// Plays a single continuous tone through a Web Audio oscillator. The AudioContext is created
// lazily on the first play() (a user gesture) and injected in tests. Always cleans itself up.
export function useToneGenerator({ createContext = defaultCreateContext } = {}) {
  const isPlaying = ref(false)
  const isSupported = ref(defaultIsSupported())

  let context = null
  let oscillator = null
  let gainNode = null

  function play({ frequency = 440, waveform = 'sine', volume = 0.2 } = {}) {
    if (isPlaying.value) return
    context = context || createContext()
    if (!context) {
      isSupported.value = false
      return
    }
    if (context.state === 'suspended') context.resume?.()

    oscillator = context.createOscillator()
    gainNode = context.createGain()
    oscillator.type = waveform
    oscillator.frequency.value = clampFrequency(frequency)
    gainNode.gain.value = 0
    oscillator.connect(gainNode)
    gainNode.connect(context.destination)
    oscillator.start()
    rampGain(clampVolume(volume))
    isPlaying.value = true
  }

  function stop() {
    if (!isPlaying.value) return
    rampGain(0)
    const stopping = oscillator
    const at = (context?.currentTime ?? 0) + RAMP_SECONDS * 2
    try {
      stopping?.stop(at)
    } catch {
      // Some engines throw if already stopped; ignore.
    }
    oscillator = null
    gainNode = null
    isPlaying.value = false
  }

  function setFrequency(hz) {
    if (oscillator) oscillator.frequency.value = clampFrequency(hz)
  }

  function setWaveform(type) {
    if (oscillator) oscillator.type = type
  }

  function setVolume(volume) {
    rampGain(clampVolume(volume))
  }

  function dispose() {
    stop()
    context?.close?.()
    context = null
  }

  function rampGain(target) {
    if (!gainNode || !context) return
    const now = context.currentTime ?? 0
    const gain = gainNode.gain
    gain.cancelScheduledValues?.(now)
    gain.setValueAtTime?.(gain.value, now)
    gain.linearRampToValueAtTime?.(target, now + RAMP_SECONDS)
  }

  return { isPlaying, isSupported, play, stop, setFrequency, setWaveform, setVolume, dispose }
}

function clampVolume(volume) {
  const value = Number(volume)
  if (!Number.isFinite(value)) return 0.2
  return Math.min(1, Math.max(0, value))
}

function defaultIsSupported() {
  return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext)
}

function defaultCreateContext() {
  const Ctx = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null
  return Ctx ? new Ctx() : null
}
