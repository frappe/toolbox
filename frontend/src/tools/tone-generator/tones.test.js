import { describe, expect, it } from 'vitest'

import {
  clampFrequency,
  frequencyToNote,
  MAX_FREQUENCY,
  MIN_FREQUENCY,
  noteToFrequency,
  noteToMidi,
} from './tones'

describe('noteToFrequency', () => {
  it('anchors A4 to 440 Hz', () => {
    expect(noteToFrequency('A', 4)).toBe(440)
  })

  it('matches known equal-temperament pitches', () => {
    expect(noteToFrequency('C', 4)).toBeCloseTo(261.63, 1)
    expect(noteToFrequency('A', 5)).toBeCloseTo(880, 5) // one octave up doubles
    expect(noteToFrequency('A', 3)).toBeCloseTo(220, 5) // one octave down halves
  })

  it('returns null for an unknown note name', () => {
    expect(noteToFrequency('H', 4)).toBeNull()
    expect(noteToMidi('H', 4)).toBeNull()
  })
})

describe('clampFrequency', () => {
  it('keeps values inside the audible range', () => {
    expect(clampFrequency(10)).toBe(MIN_FREQUENCY)
    expect(clampFrequency(50000)).toBe(MAX_FREQUENCY)
    expect(clampFrequency(1000)).toBe(1000)
  })

  it('falls back to A4 for non-finite input', () => {
    expect(clampFrequency('abc')).toBe(440)
    expect(clampFrequency(NaN)).toBe(440)
  })
})

describe('frequencyToNote', () => {
  it('names the nearest note with zero cents when in tune', () => {
    expect(frequencyToNote(440)).toEqual({ name: 'A', octave: 4, cents: 0 })
    expect(frequencyToNote(261.63)).toMatchObject({ name: 'C', octave: 4 })
  })

  it('reports a sharp offset in cents', () => {
    const note = frequencyToNote(445) // slightly sharp of A4
    expect(note.name).toBe('A')
    expect(note.cents).toBeGreaterThan(0)
  })
})
