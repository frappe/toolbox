import { beforeEach, describe, expect, it } from 'vitest'

import { hasRecording, offerRecording, takeRecording } from './recordingHandoff'

function blobOf(size) {
  return new Blob([new Uint8Array(size)], { type: 'audio/webm' })
}

describe('recordingHandoff', () => {
  beforeEach(() => {
    takeRecording()
  })

  it('hands one recording over exactly once', () => {
    const blob = blobOf(8)

    expect(offerRecording(blob, { name: 'note.webm' })).toBe(true)
    expect(hasRecording()).toBe(true)

    expect(takeRecording()).toEqual({ blob, name: 'note.webm' })
    // Taking it clears it, so re-opening the Editor cannot resurrect a stale clip.
    expect(takeRecording()).toBe(null)
    expect(hasRecording()).toBe(false)
  })

  it('refuses an empty or missing blob', () => {
    expect(offerRecording(null)).toBe(false)
    expect(offerRecording(blobOf(0))).toBe(false)
    expect(hasRecording()).toBe(false)
  })

  it('defaults the name when the caller omits it', () => {
    offerRecording(blobOf(4))

    expect(takeRecording().name).toBe('')
  })
})
