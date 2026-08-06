import { describe, expect, it } from 'vitest'

import { advanceBeats, clampBpm, DEFAULT_BPM, MAX_BPM, MIN_BPM, tapTempoBpm, tempoTerm } from './metronome'

describe('clampBpm', () => {
  it('keeps tempo within range and rounds', () => {
    expect(clampBpm(10)).toBe(MIN_BPM)
    expect(clampBpm(9999)).toBe(MAX_BPM)
    expect(clampBpm(120.4)).toBe(120)
  })

  it('falls back to the default for non-finite input', () => {
    expect(clampBpm('x')).toBe(DEFAULT_BPM)
  })
})

describe('tapTempoBpm', () => {
  it('derives BPM from evenly spaced taps', () => {
    // 500 ms between taps → 120 BPM.
    expect(tapTempoBpm([0, 500, 1000, 1500])).toBe(120)
  })

  it('needs at least two taps', () => {
    expect(tapTempoBpm([1000])).toBeNull()
    expect(tapTempoBpm([])).toBeNull()
  })

  it('clamps an extreme tap tempo', () => {
    expect(tapTempoBpm([0, 10])).toBe(MAX_BPM) // absurdly fast taps
  })
})

describe('tempoTerm', () => {
  it('labels tempo ranges', () => {
    expect(tempoTerm(50)).toBe('Largo')
    expect(tempoTerm(90)).toBe('Andante')
    expect(tempoTerm(140)).toBe('Allegro')
    expect(tempoTerm(200)).toBe('Presto')
  })
})

describe('advanceBeats', () => {
  it('schedules the beats due before the horizon and advances state', () => {
    const { beats, state } = advanceBeats({ nextNoteTime: 0, beatInMeasure: 0 }, 1, 120, 4)
    expect(beats.map((b) => b.time)).toEqual([0, 0.5]) // 0.5 s/beat at 120 BPM
    expect(state).toEqual({ nextNoteTime: 1, beatInMeasure: 2 })
  })

  it('accents the first beat of each measure', () => {
    const { beats } = advanceBeats({ nextNoteTime: 0, beatInMeasure: 0 }, 2.1, 120, 4)
    expect(beats.map((b) => b.accent)).toEqual([true, false, false, false, true])
    expect(beats.map((b) => b.beat)).toEqual([0, 1, 2, 3, 0])
  })

  it('does not mutate the input state', () => {
    const state = { nextNoteTime: 0, beatInMeasure: 0 }
    advanceBeats(state, 1, 120, 4)
    expect(state).toEqual({ nextNoteTime: 0, beatInMeasure: 0 })
  })
})
