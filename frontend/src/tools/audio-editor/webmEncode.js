// Encode planar audio to a WebM/Opus Blob using the browser's own MediaRecorder — no dependencies
// and no licensing (Opus is royalty-free). This is real-time: playback drives the recorder, so
// encoding takes about the clip's duration. Returns null if the browser cannot record Opus.

export const OPUS_MIME = 'audio/webm;codecs=opus'
export const OPUS_BITS_PER_SECOND = 96000

export function canEncodeOpus() {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof window.MediaRecorder.isTypeSupported === 'function' &&
    window.MediaRecorder.isTypeSupported(OPUS_MIME)
  )
}

export async function encodeOpus({ channels, sampleRate }, { bitsPerSecond = OPUS_BITS_PER_SECOND } = {}) {
  const length = channels[0]?.length || 0
  if (!length || !canEncodeOpus()) return null

  const Ctx = window.AudioContext || window.webkitAudioContext
  const context = new Ctx()
  try {
    const buffer = context.createBuffer(channels.length, length, sampleRate)
    for (let channel = 0; channel < channels.length; channel += 1) {
      buffer.copyToChannel(channels[channel], channel)
    }
    const destination = context.createMediaStreamDestination()
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(destination)

    const recorder = new window.MediaRecorder(destination.stream, {
      mimeType: OPUS_MIME,
      audioBitsPerSecond: bitsPerSecond,
    })
    const chunks = []
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size) chunks.push(event.data)
    }
    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve
    })
    recorder.start()
    source.start()
    await new Promise((resolve) => {
      source.onended = resolve
    })
    recorder.stop()
    await stopped
    return new Blob(chunks, { type: 'audio/webm' })
  } finally {
    context.close?.()
  }
}
