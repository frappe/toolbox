import { describe, expect, it } from 'vitest'
import { addLap, createCountdown, createStopwatch, createTimer, pauseStopwatch, pauseTimer, readCountdown, readStopwatch, readTimer, startStopwatch, startTimer } from './timeEngines'

describe('timestamp time engines', () => {
  it('preserves timer time across pause and resume', () => {
    let timer = startTimer(createTimer(10_000, 'Tea'), 1_000)
    timer = pauseTimer(timer, 4_000)
    expect(timer.remainingMs).toBe(7_000)
    timer = startTimer(timer, 20_000)
    expect(readTimer(timer, 25_000).remainingMs).toBe(2_000)
  })

  it('recovers a completed timer from its target timestamp', () => {
    const timer = startTimer(createTimer(1_000), 100)
    expect(readTimer(timer, 1_500)).toMatchObject({ status: 'done', remainingMs: 0 })
  })

  it('keeps stopwatch elapsed time and lap splits accurate', () => {
    let stopwatch = startStopwatch(createStopwatch(), 1_000)
    stopwatch = addLap(stopwatch, 2_500)
    stopwatch = addLap(stopwatch, 4_000)
    stopwatch = pauseStopwatch(stopwatch, 5_000)
    expect(stopwatch.laps).toEqual([{ elapsedMs: 1_500, splitMs: 1_500 }, { elapsedMs: 3_000, splitMs: 1_500 }])
    expect(readStopwatch(stopwatch, 99_000).elapsedMs).toBe(4_000)
  })

  it('handles countdowns that cross a date boundary', () => {
    const target = Date.UTC(2026, 7, 2, 0, 0)
    expect(readCountdown(createCountdown(target), Date.UTC(2026, 7, 1, 23, 59)).remainingMs).toBe(60_000)
  })

  it('bounds stopwatch lap history', () => {
    const stopwatch = { ...startStopwatch(createStopwatch(), 0), laps: Array.from({ length: 1000 }, (_, index) => ({ elapsedMs: index, splitMs: 1 })) }
    expect(addLap(stopwatch, 2_000)).toBe(stopwatch)
  })
})
