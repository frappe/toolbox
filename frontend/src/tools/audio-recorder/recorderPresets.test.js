import { describe, expect, it } from 'vitest'

import { DEFAULT_PRESET_ID, RECORDER_PRESETS, resolvePreset } from './recorderPresets'

describe('recorderPresets', () => {
  it('offers the four spec presets with a bitrate and channel count', () => {
    expect(RECORDER_PRESETS.map((preset) => preset.id)).toEqual([
      'voice-compact',
      'voice-high',
      'music-standard',
      'music-high',
    ])
    for (const preset of RECORDER_PRESETS) {
      expect(preset.audioBitsPerSecond).toBeGreaterThan(0)
      expect([1, 2]).toContain(preset.channelCount)
      expect(preset.label).toBeTruthy()
      expect(preset.description).toBeTruthy()
    }
  })

  it('records voice in mono and music in stereo', () => {
    expect(resolvePreset('voice-compact').channelCount).toBe(1)
    expect(resolvePreset('voice-high').channelCount).toBe(1)
    expect(resolvePreset('music-standard').channelCount).toBe(2)
    expect(resolvePreset('music-high').channelCount).toBe(2)
  })

  it('increases bitrate from compact voice through to high-quality music', () => {
    const rate = (id) => resolvePreset(id).audioBitsPerSecond
    expect(rate('voice-compact')).toBeLessThan(rate('voice-high'))
    expect(rate('voice-high')).toBeLessThan(rate('music-standard'))
    expect(rate('music-standard')).toBeLessThan(rate('music-high'))
  })

  it('falls back to the default preset for unknown or missing ids', () => {
    expect(resolvePreset('nope').id).toBe(DEFAULT_PRESET_ID)
    expect(resolvePreset().id).toBe(DEFAULT_PRESET_ID)
  })
})
