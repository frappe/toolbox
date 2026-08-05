// Encode planar Float32 audio to a 16-bit PCM WAV ArrayBuffer. Pure — no Web Audio — so it is
// unit-tested directly. `channels` is one Float32Array per channel, all the same length; samples
// are clamped to [-1, 1]. WAV/PCM is uncompressed and royalty-free, which is why the editor
// exports it (no codec licence, no ffmpeg).

const HEADER_BYTES = 44
const BITS_PER_SAMPLE = 16
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8

export function encodeWav({ channels, sampleRate }) {
  const numChannels = channels.length
  const numFrames = numChannels ? channels[0].length : 0
  const blockAlign = numChannels * BYTES_PER_SAMPLE
  const dataSize = numFrames * blockAlign
  const buffer = new ArrayBuffer(HEADER_BYTES + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // PCM fmt chunk size
  view.setUint16(20, 1, true) // audio format 1 = PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // byte rate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, BITS_PER_SAMPLE, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = HEADER_BYTES
  for (let frame = 0; frame < numFrames; frame += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      const clamped = Math.max(-1, Math.min(1, channels[channel][frame]))
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
      offset += 2
    }
  }
  return buffer
}

function writeString(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
}
