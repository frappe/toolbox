// User-facing recording quality presets (spec §7.4.3). Each maps to a target MediaRecorder
// bitrate and a channel-count constraint; the real container, codec and sample rate are
// capability-detected at record time and shown to the user afterwards. Pure data + a resolver so
// it unit-tests without a microphone.

export const RECORDER_PRESETS = [
  {
    id: 'voice-compact',
    label: 'Voice — compact',
    description: 'Smallest files for speech and memos.',
    audioBitsPerSecond: 24000,
    channelCount: 1,
  },
  {
    id: 'voice-high',
    label: 'Voice — high quality',
    description: 'Clearer speech at a modest size.',
    audioBitsPerSecond: 64000,
    channelCount: 1,
  },
  {
    id: 'music-standard',
    label: 'Music — standard',
    description: 'Balanced stereo for music and ambience.',
    audioBitsPerSecond: 128000,
    channelCount: 2,
  },
  {
    id: 'music-high',
    label: 'Music — high quality',
    description: 'Rich stereo; larger files.',
    audioBitsPerSecond: 192000,
    channelCount: 2,
  },
]

export const DEFAULT_PRESET_ID = 'voice-high'

// Always returns a valid preset (falls back to the default) so callers never handle null.
export function resolvePreset(id) {
  return (
    RECORDER_PRESETS.find((preset) => preset.id === id) ||
    RECORDER_PRESETS.find((preset) => preset.id === DEFAULT_PRESET_ID)
  )
}
