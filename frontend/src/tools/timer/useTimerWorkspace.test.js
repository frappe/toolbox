import { describe, expect, it, vi } from 'vitest'

import { STATUS } from './timeEngines'
import { useTimerWorkspace } from './useTimerWorkspace'

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  }
}

function mount({ storage, now, alarm }) {
  let intervalTick
  const workspace = useTimerWorkspace({
    now,
    storage,
    setIntervalFn: (fn) => {
      intervalTick = fn
      return 1
    },
    clearIntervalFn: () => {},
    createAlarm: () => alarm,
  })
  return { workspace, tick: () => intervalTick() }
}

describe('useTimerWorkspace', () => {
  it('persists a started countdown so it survives a reload', () => {
    const storage = memoryStorage()
    const now = () => 1_000_000
    mount({ storage, now, alarm: { play: vi.fn(), stop: vi.fn() } }).workspace.setCountdown(1_060_000)

    const reloaded = mount({ storage, now, alarm: { play: vi.fn(), stop: vi.fn() } })

    expect(reloaded.workspace.state.countdown.targetAt).toBe(1_060_000)
    expect(reloaded.workspace.state.countdown.status).toBe(STATUS.RUNNING)
  })

  it('rings the timer alarm once and does not replay it after a reload', () => {
    const storage = memoryStorage()
    let clock = 1_000_000
    const now = () => clock
    const firstAlarm = { play: vi.fn(), stop: vi.fn() }
    const first = mount({ storage, now, alarm: firstAlarm })

    first.workspace.configureTimer(1000, 'Tea')
    first.workspace.toggleTimer()
    expect(firstAlarm.play).not.toHaveBeenCalled()

    clock += 2000
    first.tick()
    expect(firstAlarm.play).toHaveBeenCalledTimes(1)

    // Reloading with the same storage must not replay the alarm (DONE was persisted).
    const secondAlarm = { play: vi.fn(), stop: vi.fn() }
    mount({ storage, now, alarm: secondAlarm })
    expect(secondAlarm.play).not.toHaveBeenCalled()
  })
})
