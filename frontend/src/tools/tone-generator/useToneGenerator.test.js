import { describe, expect, it, vi } from 'vitest'

import { useToneGenerator } from './useToneGenerator'

function mockContext() {
  const gain = {
    value: 0,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn((target) => {
      gain.value = target
    }),
  }
  const oscillator = { type: 'sine', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
  const gainNode = { gain, connect: vi.fn() }
  const ctx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn(),
    close: vi.fn(),
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gainNode),
  }
  return { ctx, oscillator, gain }
}

describe('useToneGenerator', () => {
  it('plays a tone with the requested frequency and waveform', () => {
    const { ctx, oscillator } = mockContext()
    const tone = useToneGenerator({ createContext: () => ctx })
    tone.play({ frequency: 440, waveform: 'square', volume: 0.3 })
    expect(tone.isPlaying.value).toBe(true)
    expect(oscillator.type).toBe('square')
    expect(oscillator.frequency.value).toBe(440)
    expect(oscillator.start).toHaveBeenCalled()
  })

  it('clamps frequency into the audible range', () => {
    const { ctx, oscillator } = mockContext()
    const tone = useToneGenerator({ createContext: () => ctx })
    tone.play({ frequency: 50000 })
    expect(oscillator.frequency.value).toBe(20000)
  })

  it('ignores a second play while already sounding', () => {
    const { ctx } = mockContext()
    const tone = useToneGenerator({ createContext: () => ctx })
    tone.play({ frequency: 440 })
    tone.play({ frequency: 880 })
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1)
  })

  it('updates a live tone and stops cleanly', () => {
    const { ctx, oscillator } = mockContext()
    const tone = useToneGenerator({ createContext: () => ctx })
    tone.play({ frequency: 440 })
    tone.setFrequency(220)
    expect(oscillator.frequency.value).toBe(220)
    tone.setWaveform('triangle')
    expect(oscillator.type).toBe('triangle')
    tone.stop()
    expect(tone.isPlaying.value).toBe(false)
    expect(oscillator.stop).toHaveBeenCalled()
  })

  it('marks itself unsupported when no AudioContext exists', () => {
    const tone = useToneGenerator({ createContext: () => null })
    tone.play({ frequency: 440 })
    expect(tone.isPlaying.value).toBe(false)
    expect(tone.isSupported.value).toBe(false)
  })
})
