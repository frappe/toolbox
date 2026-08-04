import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useTextToSpeech } from '@/tools/text-to-speech/useTextToSpeech'

const VOICES = [
  { voiceURI: 'net', name: 'Cloud', lang: 'en-US', localService: false },
  { voiceURI: 'local', name: 'Local', lang: 'en-GB', localService: true },
]

function fakeSynth(voices = VOICES) {
  return {
    getVoices: () => voices,
    speak: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    cancel: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

function run(options) {
  const scope = effectScope()
  let tts
  scope.run(() => {
    tts = useTextToSpeech({ createUtterance: (text) => ({ text }), ...options })
  })
  return { tts, scope }
}

describe('useTextToSpeech', () => {
  it('reports unsupported when speech synthesis is missing', () => {
    const { tts, scope } = run({ synth: undefined })
    expect(tts.supported).toBe(false)
    scope.stop()
  })

  it('prefers an on-device voice and flags network voices', () => {
    const { tts, scope } = run({ synth: fakeSynth() })
    expect(tts.selectedVoiceURI.value).toBe('local')
    expect(tts.usesNetworkVoice.value).toBe(false)

    tts.selectedVoiceURI.value = 'net'
    expect(tts.usesNetworkVoice.value).toBe(true)
    scope.stop()
  })

  it('speaks the text with the chosen voice, rate, and pitch', () => {
    const synth = fakeSynth()
    const spoken = []
    const { tts, scope } = run({ synth, createUtterance: (text) => { const u = { text }; spoken.push(u); return u } })
    tts.text.value = 'Hello there'
    tts.rate.value = 1.5
    tts.pitch.value = 0.8
    tts.speak()

    expect(synth.speak).toHaveBeenCalledOnce()
    expect(spoken[0]).toMatchObject({ text: 'Hello there', rate: 1.5, pitch: 0.8 })
    expect(spoken[0].voice.voiceURI).toBe('local')
    scope.stop()
  })

  it('ignores empty text and stops cleanly', () => {
    const synth = fakeSynth()
    const { tts, scope } = run({ synth })
    tts.text.value = '   '
    tts.speak()
    expect(synth.speak).not.toHaveBeenCalled()

    tts.stop()
    expect(synth.cancel).toHaveBeenCalled()
    expect(tts.speaking.value).toBe(false)
    scope.stop()
  })
})
