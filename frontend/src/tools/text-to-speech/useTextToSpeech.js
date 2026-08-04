import { computed, onScopeDispose, ref } from 'vue'

// Wraps the browser Web Speech API. No audio ever leaves the device for on-device voices;
// some browsers also expose network voices (localService === false), which we surface so the
// user can avoid sending text to a voice provider.
export function useTextToSpeech({
  synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined,
  createUtterance = (text) => new window.SpeechSynthesisUtterance(text),
} = {}) {
  const supported = Boolean(synth && typeof createUtterance === 'function')
  const text = ref('')
  const voices = ref([])
  const selectedVoiceURI = ref('')
  const rate = ref(1)
  const pitch = ref(1)
  const speaking = ref(false)
  const paused = ref(false)

  const selectedVoice = computed(
    () => voices.value.find((voice) => voice.voiceURI === selectedVoiceURI.value) ?? null,
  )
  const usesNetworkVoice = computed(() =>
    selectedVoice.value ? selectedVoice.value.localService === false : false,
  )

  function loadVoices() {
    if (!supported) return
    const available = synth.getVoices() || []
    voices.value = available
    if (available.length && !available.some((voice) => voice.voiceURI === selectedVoiceURI.value)) {
      const onDevice = available.find((voice) => voice.localService)
      selectedVoiceURI.value = (onDevice ?? available[0]).voiceURI
    }
  }

  function speak() {
    if (!supported || !text.value.trim()) return
    synth.cancel()
    const utterance = createUtterance(text.value)
    if (selectedVoice.value) utterance.voice = selectedVoice.value
    utterance.rate = rate.value
    utterance.pitch = pitch.value
    utterance.onstart = () => {
      speaking.value = true
      paused.value = false
    }
    utterance.onend = utterance.onerror = () => {
      speaking.value = false
      paused.value = false
    }
    synth.speak(utterance)
  }

  function pause() {
    if (supported && speaking.value && !paused.value) {
      synth.pause()
      paused.value = true
    }
  }

  function resume() {
    if (supported && paused.value) {
      synth.resume()
      paused.value = false
    }
  }

  function stop() {
    if (!supported) return
    synth.cancel()
    speaking.value = false
    paused.value = false
  }

  if (supported) {
    loadVoices()
    synth.addEventListener?.('voiceschanged', loadVoices)
    onScopeDispose(() => {
      synth.removeEventListener?.('voiceschanged', loadVoices)
      synth.cancel()
    })
  }

  return {
    supported,
    text,
    voices,
    selectedVoiceURI,
    selectedVoice,
    usesNetworkVoice,
    rate,
    pitch,
    speaking,
    paused,
    loadVoices,
    speak,
    pause,
    resume,
    stop,
  }
}
