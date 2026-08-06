// Pure formatting + WAV-header parsing for the Audio Inspector. No Web Audio, so it unit-tests
// directly.
//
// Note on sample rate: the browser's decodeAudioData RESAMPLES to the AudioContext's rate, so the
// decoded buffer's sampleRate is not the file's. We therefore read the true sample rate and bit
// depth straight from the WAV header when the file is a WAV; compressed formats contribute only
// duration, channel count and the waveform (which decode reliably).

export function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0)
  const mins = Math.floor(total / 60)
  const secs = Math.floor(total % 60)
  const tenths = Math.floor((total * 10) % 10)
  return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

export function channelLabel(count) {
  if (count === 1) return 'Mono (1 channel)'
  if (count === 2) return 'Stereo (2 channels)'
  return `${count} channels`
}

// Read channels / sampleRate / bitDepth from a WAV (RIFF/WAVE) buffer, scanning chunks for `fmt `.
// Returns null for anything that is not a standard PCM WAV.
export function parseWavHeader(arrayBuffer) {
  const view = new DataView(arrayBuffer)
  if (view.byteLength < 44 || readTag(view, 0) !== 'RIFF' || readTag(view, 8) !== 'WAVE') return null
  let offset = 12
  while (offset + 8 <= view.byteLength) {
    const tag = readTag(view, offset)
    const size = view.getUint32(offset + 4, true)
    if (tag === 'fmt ' && offset + 24 <= view.byteLength) {
      return {
        channels: view.getUint16(offset + 10, true),
        sampleRate: view.getUint32(offset + 12, true),
        bitDepth: view.getUint16(offset + 22, true),
      }
    }
    offset += 8 + size + (size % 2) // chunks are word-aligned
  }
  return null
}

// Build the display rows from decoded audio, the File, and an optional parsed WAV header.
export function describeAudio(decoded, file, header = null) {
  const rows = [
    { label: 'File', value: file.name || 'audio' },
    { label: 'Type', value: file.type || 'Unknown' },
    { label: 'Size', value: formatBytes(file.size) },
    { label: 'Duration', value: formatDuration(decoded.duration) },
    { label: 'Channels', value: channelLabel(header ? header.channels : decoded.numberOfChannels) },
  ]
  if (header) {
    rows.push({ label: 'Sample rate', value: `${header.sampleRate.toLocaleString('en-US')} Hz` })
    rows.push({ label: 'Bit depth', value: `${header.bitDepth}-bit` })
  }
  return rows
}

function readTag(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  )
}
