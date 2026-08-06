// Pure metronome timing: tempo clamping, tap-tempo estimation, and the lookahead schedule advance
// (which beats fall due, and which are accented downbeats). No Web Audio, so it unit-tests directly.

export const MIN_BPM = 30
export const MAX_BPM = 300
export const DEFAULT_BPM = 120
export const BEATS_PER_MEASURE_OPTIONS = [1, 2, 3, 4, 5, 6]

export function clampBpm(bpm) {
  const value = Math.round(Number(bpm))
  if (!Number.isFinite(value)) return DEFAULT_BPM
  return Math.min(MAX_BPM, Math.max(MIN_BPM, value))
}

// Estimate BPM from recent tap timestamps (ms). Needs at least two taps; averages the most recent
// intervals so the tempo settles quickly.
export function tapTempoBpm(timestamps) {
  if (!Array.isArray(timestamps) || timestamps.length < 2) return null
  const recent = timestamps.slice(-6)
  const intervals = []
  for (let i = 1; i < recent.length; i += 1) intervals.push(recent[i] - recent[i - 1])
  const valid = intervals.filter((ms) => ms > 0)
  if (!valid.length) return null
  const average = valid.reduce((sum, ms) => sum + ms, 0) / valid.length
  return clampBpm(60000 / average)
}

// The Italian tempo marking for a BPM, for a friendly label under the number.
export function tempoTerm(bpm) {
  const value = clampBpm(bpm)
  if (value < 60) return 'Largo'
  if (value < 76) return 'Adagio'
  if (value < 108) return 'Andante'
  if (value < 120) return 'Moderato'
  if (value < 168) return 'Allegro'
  return 'Presto'
}

// Advance the schedule up to `until` seconds, returning the beats to play and the next state.
// Pure: `state` ({ nextNoteTime, beatInMeasure }) is not mutated. The first beat of each measure
// is the accented downbeat.
export function advanceBeats(state, until, bpm, beatsPerMeasure) {
  const secondsPerBeat = 60 / clampBpm(bpm)
  const measure = Math.max(1, Math.round(beatsPerMeasure) || 1)
  const beats = []
  let { nextNoteTime, beatInMeasure } = state
  let guard = 0
  while (nextNoteTime < until && guard < 1000) {
    beats.push({ time: nextNoteTime, beat: beatInMeasure, accent: beatInMeasure === 0 })
    nextNoteTime += secondsPerBeat
    beatInMeasure = (beatInMeasure + 1) % measure
    guard += 1
  }
  return { beats, state: { nextNoteTime, beatInMeasure } }
}
