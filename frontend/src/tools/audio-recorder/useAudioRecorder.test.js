import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { pickSupportedMime, useAudioRecorder } from './useAudioRecorder'

// A MediaRecorder stand-in. The real one needs a microphone, but the capture limits and the disk
// sink are ordinary logic driven by ondataavailable, so a fake exercises them directly.
class FakeMediaRecorder {
  static instances = []
  static isTypeSupported = (type) => type === 'audio/webm;codecs=opus'

  constructor(stream, options) {
    this.stream = stream
    this.options = options
    this.state = 'inactive'
    this.ondataavailable = null
    this.onstop = null
    FakeMediaRecorder.instances.push(this)
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.onstop?.()
  }

  emit(size) {
    this.ondataavailable?.({ data: new Blob([new Uint8Array(size)], { type: 'audio/webm' }) })
  }
}

function stubBrowser() {
  const track = { stop: vi.fn() }
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn(async () => ({ getTracks: () => [track] })),
      enumerateDevices: vi.fn(async () => []),
    },
  })
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  window.MediaRecorder = FakeMediaRecorder
  window.AudioContext = undefined
  window.webkitAudioContext = undefined
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake')
  globalThis.URL.revokeObjectURL = vi.fn()
}

beforeEach(() => {
  FakeMediaRecorder.instances = []
  stubBrowser()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const latest = () => FakeMediaRecorder.instances.at(-1)

describe('pickSupportedMime', () => {
  it('returns the first candidate the browser supports', () => {
    expect(pickSupportedMime({ MediaRecorder: FakeMediaRecorder })).toBe('audio/webm;codecs=opus')
  })

  it('returns empty when the browser cannot answer', () => {
    expect(pickSupportedMime({})).toBe('')
    expect(pickSupportedMime({ MediaRecorder: {} })).toBe('')
  })
})

describe('useAudioRecorder capture limits', () => {
  it('stops at the size limit and says why', async () => {
    const recorder = useAudioRecorder({ maxBytes: 1000 })
    await recorder.start()

    latest().emit(600)
    expect(recorder.state.value).toBe('recording')
    expect(recorder.bytes.value).toBe(600)

    latest().emit(600)
    expect(recorder.state.value).toBe('stopped')
    expect(recorder.limitReached.value).toBe('size')
    // Everything captured up to the limit is kept, not thrown away.
    expect(recorder.blob.value.size).toBe(1200)
  })

  it('stops at the duration limit and says why', async () => {
    const recorder = useAudioRecorder({ maxDurationSeconds: 2 })
    await recorder.start()

    await vi.advanceTimersByTimeAsync(1000)
    expect(recorder.state.value).toBe('recording')

    await vi.advanceTimersByTimeAsync(1400)
    expect(recorder.state.value).toBe('stopped')
    expect(recorder.limitReached.value).toBe('duration')
  })

  it('counts down the time remaining', async () => {
    const recorder = useAudioRecorder({ maxDurationSeconds: 10 })
    await recorder.start()

    await vi.advanceTimersByTimeAsync(4000)

    expect(recorder.remainingSeconds.value).toBeLessThanOrEqual(6)
    expect(recorder.remainingSeconds.value).toBeGreaterThan(5)
  })

  it('clears the limit state on reset', async () => {
    const recorder = useAudioRecorder({ maxBytes: 100 })
    await recorder.start()
    latest().emit(200)
    expect(recorder.limitReached.value).toBe('size')

    recorder.reset()

    expect(recorder.limitReached.value).toBe('')
    expect(recorder.bytes.value).toBe(0)
    expect(recorder.state.value).toBe('idle')
  })
})

describe('useAudioRecorder with a file sink', () => {
  it('writes each chunk to the file and keeps nothing in memory', async () => {
    const sink = { write: vi.fn(async () => {}), close: vi.fn(async () => {}) }
    const recorder = useAudioRecorder({ maxBytes: 10 })
    await recorder.start({ sink })

    expect(recorder.isStreamingToDisk.value).toBe(true)

    latest().emit(500)
    latest().emit(500)
    await vi.advanceTimersByTimeAsync(10)

    expect(sink.write).toHaveBeenCalledTimes(2)
    // Way past maxBytes, but the disk path has no ceiling to enforce.
    expect(recorder.state.value).toBe('recording')
    expect(recorder.bytes.value).toBe(1000)
    expect(recorder.blob.value).toBe(null)
  })

  it('reports no countdown while streaming to disk', async () => {
    const sink = { write: vi.fn(async () => {}), close: vi.fn(async () => {}) }
    const recorder = useAudioRecorder({ maxDurationSeconds: 2 })
    await recorder.start({ sink })

    await vi.advanceTimersByTimeAsync(5000)

    expect(recorder.remainingSeconds.value).toBe(Number.POSITIVE_INFINITY)
    expect(recorder.state.value).toBe('recording')
  })

  it('closes the file when the capture stops', async () => {
    const sink = { write: vi.fn(async () => {}), close: vi.fn(async () => {}) }
    const recorder = useAudioRecorder()
    await recorder.start({ sink })

    latest().emit(64)
    recorder.stop()
    await vi.advanceTimersByTimeAsync(10)

    expect(sink.close).toHaveBeenCalledOnce()
  })

  it('stops and reports when a write fails, without inventing an empty recording', async () => {
    const sink = {
      write: vi.fn(async () => {
        throw new Error('disk full')
      }),
      close: vi.fn(async () => {}),
    }
    const recorder = useAudioRecorder()
    await recorder.start({ sink })

    latest().emit(64)
    await vi.advanceTimersByTimeAsync(10)

    expect(recorder.error.value).toContain('Writing to the chosen file failed')
    // The disk branch stays selected, so the view never shows a 0-byte preview of a
    // recording that was streamed away rather than buffered.
    expect(recorder.isStreamingToDisk.value).toBe(true)
    expect(recorder.blob.value).toBe(null)
  })
})
