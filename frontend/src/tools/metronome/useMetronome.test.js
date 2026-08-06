import { afterEach, describe, expect, it, vi } from 'vitest'

import { useMetronome } from './useMetronome'

function mockContext() {
  return {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn(),
    close: vi.fn(),
    createOscillator: vi.fn(() => ({ frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() })),
    createGain: vi.fn(() => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    })),
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useMetronome', () => {
  it('starts and stops, resetting the beat', () => {
    const metro = useMetronome({ createContext: () => mockContext() })
    metro.start()
    expect(metro.isPlaying.value).toBe(true)
    metro.stop()
    expect(metro.isPlaying.value).toBe(false)
    expect(metro.currentBeat.value).toBe(-1)
  })

  it('reports unsupported when no AudioContext exists', () => {
    const metro = useMetronome({ createContext: () => null })
    metro.start()
    expect(metro.isPlaying.value).toBe(false)
    expect(metro.isSupported.value).toBe(false)
  })

  it('schedules clicks on the audio clock while playing', () => {
    vi.useFakeTimers()
    const ctx = mockContext()
    const metro = useMetronome({ createContext: () => ctx })
    metro.setBpm(120)
    metro.start()
    ctx.currentTime = 1 // advance the audio clock so several beats fall due
    vi.advanceTimersByTime(30) // fire the 25 ms scheduler once
    expect(ctx.createOscillator).toHaveBeenCalled()
    metro.stop()
  })
})
