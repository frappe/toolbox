// Turning a series of numbers into the two paths an area chart draws.
//
// Written out twice before (#280): the growth chart on the four financial calculators and the rate
// chart on the currency converter both scaled a series, joined it into a polyline and closed it
// into a polygon, with the same rounding and the same off-by-one on the last point.
//
// The break-even chart does not use this and should not be made to. It plots two straight lines
// from a formula rather than a series, and its shaded regions are triangles between them. Only the
// figure and the accessible name are shared with it, which is what `ToolChart` carries.
//
// These are plain functions rather than a composable: they take numbers and return numbers, which
// is the easiest thing to test and the easiest thing to read.

const NO_PADDING = { top: 0, right: 0, bottom: 0, left: 0 }

/** The value range a chart draws between. */
export function seriesBounds(values, { anchorAtZero = false, padFraction = 0 } = {}) {
  const finite = values.filter((value) => Number.isFinite(value))
  if (!finite.length) return { min: 0, max: 1 }

  const min = anchorAtZero ? Math.min(0, ...finite) : Math.min(...finite)
  const max = Math.max(...finite)
  // A flat series has no span of its own, and a zero range would put every point on one edge of
  // the plot. The old code hid this downstream with `range || 1`, which drew a constant rate along
  // the bottom of its chart rather than through the middle.
  const span = max - min || Math.abs(max) * 0.01 || 1
  if (max === min) return { min: min - span / 2, max: max + span / 2 }

  return padFraction ? { min: min - span * padFraction, max: max + span * padFraction } : { min, max }
}

/** Place each value in the plot, left to right. A single point sits in the middle. */
export function scalePoints(values, { width, height, padding = NO_PADDING, bounds }) {
  const pad = { ...NO_PADDING, ...padding }
  const plotWidth = width - pad.left - pad.right
  const plotHeight = height - pad.top - pad.bottom
  const range = bounds.max - bounds.min || 1
  const count = values.length

  return values.map((value, index) => ({
    x: pad.left + (count > 1 ? (index / (count - 1)) * plotWidth : plotWidth / 2),
    y: pad.top + (1 - (value - bounds.min) / range) * plotHeight,
  }))
}

export function polylinePoints(points) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
}

/** The line, closed down to the baseline at both ends, so it can be filled. */
export function areaPolygon(points, { width, height, padding = NO_PADDING }) {
  if (!points.length) return ''
  const pad = { ...NO_PADDING, ...padding }
  const baseline = height - pad.bottom
  return `${pad.left},${baseline} ${polylinePoints(points)} ${width - pad.right},${baseline}`
}
