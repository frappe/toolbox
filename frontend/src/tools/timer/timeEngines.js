export const STATUS = Object.freeze({ IDLE: 'idle', RUNNING: 'running', PAUSED: 'paused', DONE: 'done' })

export function createTimer(durationMs, label = '') {
  return { status: STATUS.IDLE, durationMs, remainingMs: durationMs, targetAt: null, label }
}

export function startTimer(state, now) {
  const remainingMs = state.status === STATUS.PAUSED ? state.remainingMs : state.durationMs
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return state
  return { ...state, status: STATUS.RUNNING, remainingMs, targetAt: now + remainingMs }
}

export function readTimer(state, now) {
  if (state.status !== STATUS.RUNNING) return state
  const remainingMs = Math.max(0, state.targetAt - now)
  return { ...state, status: remainingMs === 0 ? STATUS.DONE : STATUS.RUNNING, remainingMs }
}

export function pauseTimer(state, now) {
  const current = readTimer(state, now)
  if (current.status !== STATUS.RUNNING) return current
  return { ...current, status: STATUS.PAUSED, targetAt: null }
}

export function resetTimer(state) {
  return createTimer(state.durationMs, state.label)
}

export function createStopwatch() {
  return { status: STATUS.IDLE, accumulatedMs: 0, startedAt: null, laps: [] }
}

export function readStopwatch(state, now) {
  const elapsedMs = state.accumulatedMs + (state.status === STATUS.RUNNING ? now - state.startedAt : 0)
  return { ...state, elapsedMs: Math.max(0, elapsedMs) }
}

export function startStopwatch(state, now) {
  if (state.status === STATUS.RUNNING) return state
  return { ...state, status: STATUS.RUNNING, startedAt: now }
}

export function pauseStopwatch(state, now) {
  if (state.status !== STATUS.RUNNING) return state
  const current = readStopwatch(state, now)
  return { ...state, status: STATUS.PAUSED, accumulatedMs: current.elapsedMs, startedAt: null }
}

export function addLap(state, now) {
  if (state.status !== STATUS.RUNNING || state.laps.length >= 1000) return state
  const elapsedMs = readStopwatch(state, now).elapsedMs
  const previousMs = state.laps.at(-1)?.elapsedMs ?? 0
  return { ...state, laps: [...state.laps, { elapsedMs, splitMs: elapsedMs - previousMs }] }
}

export function createCountdown(targetAt = null) {
  return { status: targetAt ? STATUS.RUNNING : STATUS.IDLE, targetAt, remainingMs: 0 }
}

export function readCountdown(state, now) {
  if (!state.targetAt) return state
  const remainingMs = Math.max(0, state.targetAt - now)
  return { ...state, remainingMs, status: remainingMs === 0 ? STATUS.DONE : STATUS.RUNNING }
}
