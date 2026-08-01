import { describe, expect, it } from 'vitest'
import { deserializeWorkspace, loadTimerWorkspace, saveTimerWorkspace } from './timerStorage'
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
