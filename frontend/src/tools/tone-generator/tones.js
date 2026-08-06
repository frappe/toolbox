// Pure pitch maths for the Tone Generator: equal-temperament note↔frequency conversion (A4 = 440
// Hz) plus a nearest-note readout. No Web Audio, so it unit-tests directly.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle']
export const A4_FREQUENCY = 440
export const A4_MIDI = 69
// The generator stays inside the nominal human hearing range.
export const MIN_FREQUENCY = 20
export const MAX_FREQUENCY = 20000

export function noteToMidi(name, octave) {
  const index = NOTE_NAMES.indexOf(name)
  if (index === -1) return null
  return (Number(octave) + 1) * 12 + index
}

export function midiToFrequency(midi) {
  return A4_FREQUENCY * 2 ** ((midi - A4_MIDI) / 12)
}

export function noteToFrequency(name, octave) {
  const midi = noteToMidi(name, octave)
  return midi === null ? null : midiToFrequency(midi)
}

export function clampFrequency(hz) {
  const value = Number(hz)
  if (!Number.isFinite(value)) return A4_FREQUENCY
  return Math.min(MAX_FREQUENCY, Math.max(MIN_FREQUENCY, value))
}

// The nearest note to a frequency, with the cents it is sharp (+) or flat (-).
export function frequencyToNote(hz) {
  const value = clampFrequency(hz)
  const midi = Math.round(A4_MIDI + 12 * Math.log2(value / A4_FREQUENCY))
  const cents = Math.round(1200 * Math.log2(value / midiToFrequency(midi)))
  return {
    name: NOTE_NAMES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    cents,
  }
}
