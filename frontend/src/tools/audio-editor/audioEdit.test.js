import { describe, expect, it } from 'vitest'

import {
  computePeaks,
  dbToLinear,
  defaultProject,
  renderEdit,
  renderedDuration,
} from './audioEdit'

// A 1 kHz-rate source of constant 1.0 samples keeps the maths easy to reason about.
function source(length, sampleRate = 1000, value = 1) {
  return { channels: [new Float32Array(length).fill(value)], sampleRate }
}

describe('defaultProject', () => {
  it('selects the whole clip with no fades and unity gain', () => {
    expect(defaultProject(5)).toEqual({ trimStart: 0, trimEnd: 5, fadeIn: 0, fadeOut: 0, gainDb: 0 })
  })
})

describe('renderEdit', () => {
  it('keeps only the trimmed region', () => {
    const out = renderEdit(source(1000), { trimStart: 0.2, trimEnd: 0.5, fadeIn: 0, fadeOut: 0, gainDb: 0 })
    expect(out.channels[0].length).toBe(300) // 0.3s at 1000 Hz
    expect(out.channels[0][0]).toBeCloseTo(1)
  })

  it('applies gain in decibels', () => {
    const out = renderEdit(source(100), { trimStart: 0, trimEnd: 0.1, fadeIn: 0, fadeOut: 0, gainDb: -6 })
    expect(out.channels[0][50]).toBeCloseTo(dbToLinear(-6), 3) // ~0.501
  })

  it('ramps a linear fade in from silence and a fade out to silence', () => {
    const out = renderEdit(source(100), { trimStart: 0, trimEnd: 0.1, fadeIn: 0.05, fadeOut: 0.05, gainDb: 0 })
    const data = out.channels[0]
    expect(data[0]).toBeCloseTo(0) // start of fade-in is silent
    expect(data[49]).toBeGreaterThan(data[0]) // rising through the fade-in
    expect(data[99]).toBeLessThan(data[50]) // falling through the fade-out
  })

  it('handles a reversed or empty selection without throwing', () => {
    expect(renderEdit(source(100), { trimStart: 0.08, trimEnd: 0.02 }).channels[0].length).toBe(60)
    expect(renderEdit(source(100), { trimStart: 0.05, trimEnd: 0.05 }).channels[0].length).toBe(0)
  })
})

describe('renderedDuration', () => {
  it('reports the trimmed length in seconds', () => {
    expect(renderedDuration(source(1000), { trimStart: 0.1, trimEnd: 0.6 })).toBeCloseTo(0.5)
  })
})

describe('computePeaks', () => {
  it('returns absolute peaks per bucket in [0, 1]', () => {
    const channels = [new Float32Array([0, 0.5, -1, 0.25])]
    const peaks = computePeaks(channels, 2)
    expect(peaks.length).toBe(2)
    expect(peaks[0]).toBeCloseTo(0.5) // max(|0|, |0.5|)
    expect(peaks[1]).toBeCloseTo(1) // max(|-1|, |0.25|)
  })

  it('is safe on empty input', () => {
    expect(computePeaks([new Float32Array(0)], 4).length).toBe(4)
  })
})
