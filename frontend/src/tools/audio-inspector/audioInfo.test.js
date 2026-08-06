import { describe, expect, it } from 'vitest'

import { channelLabel, describeAudio, formatBytes, formatDuration, parseWavHeader } from './audioInfo'

function wavHeaderBuffer({ sampleRate = 44100, channels = 2, bitDepth = 16 } = {}) {
  const buffer = new ArrayBuffer(44)
  const view = new DataView(buffer)
  const write = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint16(34, bitDepth, true)
  write(36, 'data')
  return buffer
}

describe('formatDuration', () => {
  it('formats seconds as m:ss.t', () => {
    expect(formatDuration(0)).toBe('0:00.0')
    expect(formatDuration(75.4)).toBe('1:15.4')
  })
})

describe('formatBytes', () => {
  it('scales bytes to a readable unit', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB')
  })
})

describe('channelLabel', () => {
  it('names common channel layouts', () => {
    expect(channelLabel(1)).toContain('Mono')
    expect(channelLabel(2)).toContain('Stereo')
    expect(channelLabel(6)).toBe('6 channels')
  })
})

describe('describeAudio', () => {
  it('builds labelled rows from the buffer and file', () => {
    const decoded = { duration: 3.2, sampleRate: 44100, numberOfChannels: 2 }
    const file = { name: 'clip.mp3', type: 'audio/mpeg', size: 500000 }
    const byLabel = Object.fromEntries(describeAudio(decoded, file).map((row) => [row.label, row.value]))
    expect(byLabel.File).toBe('clip.mp3')
    expect(byLabel.Type).toBe('audio/mpeg')
    expect(byLabel.Channels).toContain('Stereo')
    expect(byLabel.Duration).toBe('0:03.2')
  })

  it('falls back for a nameless, typeless file', () => {
    const rows = describeAudio({ duration: 0, sampleRate: 8000, numberOfChannels: 1 }, { size: 0 })
    const byLabel = Object.fromEntries(rows.map((row) => [row.label, row.value]))
    expect(byLabel.File).toBe('audio')
    expect(byLabel.Type).toBe('Unknown')
  })

  it('prefers the WAV header for sample rate, bit depth and channels', () => {
    // The decoded buffer has been resampled to 48 kHz; the header keeps the true 44.1 kHz.
    const decoded = { duration: 1, sampleRate: 48000, numberOfChannels: 2 }
    const header = { sampleRate: 44100, channels: 1, bitDepth: 24 }
    const byLabel = Object.fromEntries(describeAudio(decoded, { size: 1 }, header).map((r) => [r.label, r.value]))
    expect(byLabel['Sample rate']).toBe('44,100 Hz')
    expect(byLabel['Bit depth']).toBe('24-bit')
    expect(byLabel.Channels).toContain('Mono')
  })

  it('omits sample rate and bit depth without a header', () => {
    const rows = describeAudio({ duration: 1, sampleRate: 48000, numberOfChannels: 2 }, { size: 1 })
    expect(rows.some((row) => row.label === 'Sample rate')).toBe(false)
  })
})

describe('parseWavHeader', () => {
  it('reads channels, sample rate and bit depth from a WAV', () => {
    expect(parseWavHeader(wavHeaderBuffer({ sampleRate: 44100, channels: 2, bitDepth: 16 }))).toEqual({
      channels: 2,
      sampleRate: 44100,
      bitDepth: 16,
    })
  })

  it('returns null for non-WAV data', () => {
    expect(parseWavHeader(new ArrayBuffer(8))).toBeNull()
    const ogg = new ArrayBuffer(44)
    new DataView(ogg).setUint8(0, 'O'.charCodeAt(0))
    expect(parseWavHeader(ogg)).toBeNull()
  })
})
