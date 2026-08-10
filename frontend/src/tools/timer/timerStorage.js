import { STATUS } from './timeEngines'

export const TIMER_STORAGE_KEY = 'toolbox:timer-workspace:v1'
const statuses = new Set(Object.values(STATUS))

// `sessionStorage`, like every other thing Toolbox keeps. A running timer should survive a reload,
// which this does, and should not survive the browser, which `localStorage` did: a visitor who ran
// a stopwatch and came back a week later found it still running, and the site had kept a record of
// them in between. Theme is the one key that outlives the session, and it says why on its own line.
function defaultStorage() {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

export function loadTimerWorkspace(storage = defaultStorage()) {
  try {
    return deserializeWorkspace(JSON.parse(storage?.getItem(TIMER_STORAGE_KEY)))
  } catch {
    return null
  }
}

export function saveTimerWorkspace(value, storage = defaultStorage()) {
  try {
    storage?.setItem(TIMER_STORAGE_KEY, JSON.stringify({ version: 1, ...value }))
    return true
  } catch {
    return false
  }
}

// A visitor who used the timer before this moved carries the old key on their machine, and nothing
// would ever read it again. Clearing it keeps the promise the site makes about what it stores.
export function forgetStoredWorkspace(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(TIMER_STORAGE_KEY)
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
