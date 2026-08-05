// Non-destructive audio edit model. A "source" is decoded planar audio ({ channels, sampleRate }),
// a "project" is the ordered edit state (§7.6.3) applied on export. Everything here is pure so the
// trim/fade/gain maths and the waveform peaks are unit-tested without Web Audio.

export const MAX_HISTORY = 50

// A fresh project selects the whole clip with no fades and unity gain.
export function defaultProject(durationSeconds) {
  return { trimStart: 0, trimEnd: durationSeconds, fadeIn: 0, fadeOut: 0, gainDb: 0 }
}

export function dbToLinear(db) {
  return 10 ** (db / 20)
}

// Render the source through the project into new planar channels: keep [trimStart, trimEnd], apply
// gain, then linear fade-in / fade-out envelopes on the trimmed region.
export function renderEdit(source, project) {
  const { channels, sampleRate } = source
  const totalFrames = channels[0]?.length || 0
  const from = clampFrame(project.trimStart, sampleRate, totalFrames)
  const to = clampFrame(project.trimEnd, sampleRate, totalFrames)
  const start = Math.min(from, to)
  const length = Math.max(0, Math.max(from, to) - start)

  const gain = dbToLinear(project.gainDb || 0)
  const fadeIn = Math.min(length, Math.round(Math.max(0, project.fadeIn || 0) * sampleRate))
  const fadeOut = Math.min(length, Math.round(Math.max(0, project.fadeOut || 0) * sampleRate))

  const out = channels.map((data) => {
    const slice = new Float32Array(length)
    for (let i = 0; i < length; i += 1) {
      let value = data[start + i] * gain
      if (fadeIn && i < fadeIn) value *= i / fadeIn
      if (fadeOut && i >= length - fadeOut) value *= (length - i) / fadeOut
      slice[i] = value
    }
    return slice
  })
  return { channels: out, sampleRate }
}

// The rendered duration in seconds — used for labels without allocating the output.
export function renderedDuration(source, project) {
  const totalFrames = source.channels[0]?.length || 0
  const from = clampFrame(project.trimStart, source.sampleRate, totalFrames)
  const to = clampFrame(project.trimEnd, source.sampleRate, totalFrames)
  return Math.abs(to - from) / source.sampleRate
}

// Downsample to `buckets` absolute-peak values in [0, 1] for a lightweight waveform.
export function computePeaks(channels, buckets) {
  const length = channels[0]?.length || 0
  const peaks = new Float32Array(buckets)
  if (!length || buckets <= 0) return peaks
  const per = length / buckets
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const start = Math.floor(bucket * per)
    const end = Math.min(length, Math.floor((bucket + 1) * per))
    let max = 0
    for (let i = start; i < end; i += 1) {
      for (let channel = 0; channel < channels.length; channel += 1) {
        const magnitude = Math.abs(channels[channel][i])
        if (magnitude > max) max = magnitude
      }
    }
    peaks[bucket] = max
  }
  return peaks
}

function clampFrame(seconds, sampleRate, totalFrames) {
  const frame = Math.round((Number(seconds) || 0) * sampleRate)
  return Math.max(0, Math.min(totalFrames, frame))
}
