import { describe, expect, it, vi } from 'vitest'
import {
  TIMER_STORAGE_KEY,
  deserializeWorkspace,
  forgetStoredWorkspace,
  loadTimerWorkspace,
  saveTimerWorkspace,
} from './timerStorage'
import { createCountdown, createStopwatch, createTimer } from './timeEngines'

const workspace = { timer: createTimer(60_000), stopwatch: createStopwatch(), countdown: createCountdown() }

describe('timer workspace persistence', () => {
  it('round trips valid versioned state', () => {
    const values = new Map()
    const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) }
    expect(saveTimerWorkspace(workspace, storage)).toBe(true)
    expect(loadTimerWorkspace(storage)).toEqual(workspace)
  })

  it('rejects malformed, unknown, and unsafe state', () => {
    expect(deserializeWorkspace({ version: 2, ...workspace })).toBeNull()
    expect(deserializeWorkspace({ version: 1, ...workspace, timer: { ...workspace.timer, durationMs: Infinity } })).toBeNull()
    expect(loadTimerWorkspace({ getItem: () => '{broken' })).toBeNull()
  })
})

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

describe('where the workspace is kept', () => {
  it('uses sessionStorage, so it goes when the browser session does', () => {
    // A running timer should survive a reload and not survive the browser. Theme is the one key
    // that outlives a session, and it says why on its own line.
    const session = memoryStorage()
    const local = memoryStorage()
    vi.stubGlobal('sessionStorage', session)
    vi.stubGlobal('localStorage', local)

    try {
      expect(saveTimerWorkspace(workspace)).toBe(true)
      expect(session.getItem(TIMER_STORAGE_KEY)).toBeTruthy()
      expect(local.getItem(TIMER_STORAGE_KEY)).toBeNull()
      expect(loadTimerWorkspace()).toEqual(workspace)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('forgets the key the old default left on a returning visitor', () => {
    const local = memoryStorage()
    local.setItem(TIMER_STORAGE_KEY, JSON.stringify({ version: 1 }))

    expect(forgetStoredWorkspace(local)).toBe(true)
    expect(local.getItem(TIMER_STORAGE_KEY)).toBeNull()
  })

  it('reads and writes nothing when a browser blocks storage', () => {
    const blocked = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
      removeItem() {
        throw new Error('blocked')
      },
    }

    expect(loadTimerWorkspace(blocked)).toBeNull()
    expect(saveTimerWorkspace(workspace, blocked)).toBe(false)
    expect(forgetStoredWorkspace(blocked)).toBe(false)
  })
})
