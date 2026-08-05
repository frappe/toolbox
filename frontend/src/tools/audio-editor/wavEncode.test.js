import { describe, expect, it } from 'vitest'

import { encodeWav } from './wavEncode'

function readString(view, offset, length) {
  let text = ''
  for (let i = 0; i < length; i += 1) text += String.fromCharCode(view.getUint8(offset + i))
  return text
}

describe('encodeWav', () => {
  it('writes a valid PCM WAV header', () => {
    const buffer = encodeWav({ channels: [new Float32Array([0, 0])], sampleRate: 8000 })
    const view = new DataView(buffer)
    expect(readString(view, 0, 4)).toBe('RIFF')
    expect(readString(view, 8, 4)).toBe('WAVE')
    expect(readString(view, 12, 4)).toBe('fmt ')
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(8000) // sample rate
    expect(view.getUint16(34, true)).toBe(16) // bits per sample
    expect(readString(view, 36, 4)).toBe('data')
  })

  it('sizes the buffer for the frame count and channels', () => {
    const stereo = encodeWav({ channels: [new Float32Array(10), new Float32Array(10)], sampleRate: 44100 })
    // 44-byte header + 10 frames * 2 channels * 2 bytes.
    expect(stereo.byteLength).toBe(44 + 10 * 2 * 2)
    const view = new DataView(stereo)
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(40, true)).toBe(10 * 2 * 2) // data chunk size
  })

  it('clamps and quantises samples to signed 16-bit', () => {
    const buffer = encodeWav({ channels: [new Float32Array([1, -1, 2])], sampleRate: 8000 })
    const view = new DataView(buffer)
    expect(view.getInt16(44, true)).toBe(32767) // +1.0 full scale
    expect(view.getInt16(46, true)).toBe(-32768) // -1.0 full scale
    expect(view.getInt16(48, true)).toBe(32767) // +2.0 clamped to +1.0
  })

  it('interleaves stereo frames', () => {
    const left = new Float32Array([1, 0])
    const right = new Float32Array([0, -1])
    const view = new DataView(encodeWav({ channels: [left, right], sampleRate: 8000 }))
    expect(view.getInt16(44, true)).toBe(32767) // frame 0 left
    expect(view.getInt16(46, true)).toBe(0) // frame 0 right
    expect(view.getInt16(48, true)).toBe(0) // frame 1 left
    expect(view.getInt16(50, true)).toBe(-32768) // frame 1 right
  })
})
