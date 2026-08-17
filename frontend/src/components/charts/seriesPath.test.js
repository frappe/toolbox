import { describe, expect, it } from 'vitest'

import { areaPolygon, polylinePoints, scalePoints, seriesBounds } from './seriesPath'

const SIZE = { width: 100, height: 100 }

describe('seriesBounds', () => {
  it('reads the range of the values', () => {
    expect(seriesBounds([10, 30, 20])).toEqual({ min: 10, max: 30 })
  })

  // Growth from 100 to 110 looks like a cliff on its own range and like growth against zero,
  // which is the honest picture for money over time.
  it('anchors at zero when asked, so growth reads honestly', () => {
    expect(seriesBounds([100, 110], { anchorAtZero: true })).toEqual({ min: 0, max: 110 })
  })

  // A rate hovers around a value rather than climbing from zero, so its extremes get room.
  it('pads the extremes by a fraction of the span', () => {
    expect(seriesBounds([10, 20], { padFraction: 0.1 })).toEqual({ min: 9, max: 21 })
  })

  it('gives a flat series a span, so its points do not collapse onto one line', () => {
    const { min, max } = seriesBounds([5, 5, 5])
    expect(max).toBeGreaterThan(min)
  })

  it('survives an empty or non-finite series', () => {
    expect(seriesBounds([])).toEqual({ min: 0, max: 1 })
    expect(seriesBounds([Number.NaN, Infinity])).toEqual({ min: 0, max: 1 })
  })
})

describe('scalePoints', () => {
  it('spreads the series across the width and inverts the value axis', () => {
    const points = scalePoints([0, 50, 100], { ...SIZE, bounds: { min: 0, max: 100 } })

    expect(points.map((p) => p.x)).toEqual([0, 50, 100])
    // y grows downward in SVG, so the largest value sits at the top.
    expect(points.map((p) => p.y)).toEqual([100, 50, 0])
  })

  it('centres a single point rather than pinning it to the left edge', () => {
    const [only] = scalePoints([42], { ...SIZE, bounds: { min: 0, max: 100 } })
    expect(only.x).toBe(50)
  })

  it('insets the plot by the padding it is given', () => {
    const padding = { top: 10, right: 10, bottom: 10, left: 10 }
    const points = scalePoints([0, 100], { ...SIZE, padding, bounds: { min: 0, max: 100 } })

    expect(points[0]).toEqual({ x: 10, y: 90 })
    expect(points[1]).toEqual({ x: 90, y: 10 })
  })
})

describe('polylinePoints and areaPolygon', () => {
  it('writes the points at one decimal', () => {
    expect(polylinePoints([{ x: 1.234, y: 5.678 }])).toBe('1.2,5.7')
  })

  it('closes the line down to the baseline at both ends', () => {
    const points = scalePoints([0, 100], { ...SIZE, bounds: { min: 0, max: 100 } })
    expect(areaPolygon(points, SIZE)).toBe('0,100 0.0,100.0 100.0,0.0 100,100')
  })

  it('draws nothing for an empty series', () => {
    expect(areaPolygon([], SIZE)).toBe('')
  })
})
