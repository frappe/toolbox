import { STATUS } from './timeEngines'

export const TIMER_STORAGE_KEY = 'toolbox:timer-workspace:v1'
const statuses = new Set(Object.values(STATUS))

export function loadTimerWorkspace(storage = globalThis.localStorage) {
  try {
    return deserializeWorkspace(JSON.parse(storage?.getItem(TIMER_STORAGE_KEY)))
  } catch {
    return null
  }
}

export function saveTimerWorkspace(value, storage = globalThis.localStorage) {
  try {
    storage?.setItem(TIMER_STORAGE_KEY, JSON.stringify({ version: 1, ...value }))
    return true
  } catch {
    return false
  }
}

export function deserializeWorkspace(value) {
  if (!isObject(value) || value.version !== 1) return null
  if (!validTimer(value.timer) || !validStopwatch(value.stopwatch) || !validCountdown(value.countdown)) return null
  return { timer: value.timer, stopwatch: value.stopwatch, countdown: value.countdown }
}

function validTimer(value) {
  return isObject(value) && statuses.has(value.status) && finiteNonnegative(value.durationMs) &&
    finiteNonnegative(value.remainingMs) && nullableNumber(value.targetAt) && typeof value.label === 'string'
}

function validStopwatch(value) {
  return isObject(value) && statuses.has(value.status) && finiteNonnegative(value.accumulatedMs) &&
    nullableNumber(value.startedAt) && Array.isArray(value.laps) && value.laps.every((lap) =>
      isObject(lap) && finiteNonnegative(lap.elapsedMs) && finiteNonnegative(lap.splitMs))
}

function validCountdown(value) {
  return isObject(value) && statuses.has(value.status) && nullableNumber(value.targetAt) && finiteNonnegative(value.remainingMs)
}

function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function finiteNonnegative(value) { return Number.isFinite(value) && value >= 0 }
function nullableNumber(value) { return value === null || Number.isFinite(value) }
