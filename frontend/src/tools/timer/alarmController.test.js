import { expect, it, vi } from 'vitest'
import { createAlarmController } from './alarmController'

it('stops the active alarm before starting another one', () => {
  const oscillators = []
  const context = { currentTime: 0, destination: {}, createGain: () => ({ gain: { setValueAtTime() {} }, connect() { return this } }), createOscillator: () => { const oscillator = { frequency: {}, connect() { return this }, start: vi.fn(), stop: vi.fn() }; oscillators.push(oscillator); return oscillator } }
  const alarm = createAlarmController(() => context)
  alarm.play()
  alarm.play()
  expect(oscillators[0].stop).toHaveBeenCalledTimes(2)
  expect(oscillators[1].start).toHaveBeenCalledOnce()
})
