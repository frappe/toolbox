<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-audio-waveform" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Media</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">Tone Generator</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Play a precise pure tone for tuning, testing speakers, or a reference pitch — generated locally in your browser.</p>
      </div>
      <Button variant="subtle" icon="lucide-star" :label="preferences.isFavourite(TOOL_ID) ? 'Favourited' : 'Favourite'" @click="preferences.toggleFavourite(TOOL_ID)" />
    </header>

    <p v-if="!tone.isSupported.value" class="mt-8 flex items-center gap-2 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 text-sm text-ink-gray-6">
      <Icon name="lucide-volume-x" class="size-5 shrink-0 text-ink-gray-5" />
      Tone generation needs a browser with the Web Audio API.
    </p>

    <section v-else class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5 sm:p-6" aria-label="Tone controls">
      <div class="flex flex-col items-center gap-3 py-2">
        <p class="text-5xl font-semibold tabular-nums text-ink-gray-9">{{ Math.round(frequency) }}<span class="pl-1 text-xl font-medium text-ink-gray-5">Hz</span></p>
        <p class="text-sm text-ink-gray-6">Nearest note: <span class="font-medium text-ink-gray-8">{{ noteLabel }}</span></p>
        <Button
          class="mt-1"
          size="lg"
          :variant="tone.isPlaying.value ? 'outline' : 'solid'"
          :icon-left="tone.isPlaying.value ? 'lucide-square' : 'lucide-play'"
          :label="tone.isPlaying.value ? 'Stop' : 'Play'"
          @click="toggle"
        />
      </div>

      <label class="mt-8 grid gap-2 text-sm font-medium text-ink-gray-7">
        <span>Frequency</span>
        <input type="range" min="20" max="2000" step="1" :value="Math.min(frequency, 2000)" aria-label="Frequency" @input="updateFrequency($event.target.value)" />
        <div class="flex items-center gap-2">
          <input type="number" min="20" max="20000" step="1" :value="Math.round(frequency)" aria-label="Frequency in hertz" class="h-10 w-32 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3" @change="updateFrequency($event.target.value)" />
          <span class="text-sm text-ink-gray-5">Hz (20–20,000)</span>
        </div>
      </label>

      <div class="mt-6 grid gap-2 text-sm font-medium text-ink-gray-7">
        <span>Tune to a note</span>
        <div class="flex gap-2">
          <select v-model="pickNote" aria-label="Note" class="h-10 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3" @change="snapToNote">
            <option v-for="note in NOTE_NAMES" :key="note" :value="note">{{ note }}</option>
          </select>
          <select v-model.number="pickOctave" aria-label="Octave" class="h-10 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3" @change="snapToNote">
            <option v-for="octave in OCTAVES" :key="octave" :value="octave">Octave {{ octave }}</option>
          </select>
        </div>
      </div>

      <div class="mt-6 grid gap-2 text-sm font-medium text-ink-gray-7">
        <span>Waveform</span>
        <div class="flex flex-wrap gap-2" role="group" aria-label="Waveform">
          <button
            v-for="shape in WAVEFORMS"
            :key="shape"
            type="button"
            class="h-9 rounded-lg border px-3 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
            :class="waveform === shape ? 'border-outline-gray-4 bg-surface-gray-3 text-ink-gray-9' : 'border-outline-gray-2 bg-surface-base text-ink-gray-7 hover:border-outline-gray-3'"
            :aria-pressed="waveform === shape"
            @click="updateWaveform(shape)"
          >
            {{ shape }}
          </button>
        </div>
      </div>

      <label class="mt-6 grid gap-2 text-sm font-medium text-ink-gray-7">
        <span class="flex justify-between"><span>Volume</span><span class="tabular-nums text-ink-gray-5">{{ Math.round(volume * 100) }}%</span></span>
        <input type="range" min="0" max="1" step="0.01" :value="volume" aria-label="Volume" @input="updateVolume($event.target.value)" />
      </label>

      <div class="mt-6 flex flex-wrap gap-2">
        <Button variant="subtle" label="A4 · 440 Hz" @click="preset(440)" />
        <Button variant="subtle" label="1 kHz test tone" @click="preset(1000)" />
      </div>

      <p class="mt-6 text-xs leading-5 text-ink-gray-5">Tones are generated locally with the Web Audio API — nothing is recorded or sent anywhere. Start at a low volume to protect your hearing and speakers.</p>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { useToneGenerator } from '@/tools/tone-generator/useToneGenerator'
import { clampFrequency, frequencyToNote, NOTE_NAMES, noteToFrequency, WAVEFORMS } from '@/tools/tone-generator/tones'

const TOOL_ID = 'tone-generator'
const OCTAVES = [1, 2, 3, 4, 5, 6, 7, 8]

const preferences = useToolboxPreferences()
const tone = useToneGenerator()

const frequency = ref(440)
const waveform = ref('sine')
const volume = ref(0.2)
const pickNote = ref('A')
const pickOctave = ref(4)

const noteLabel = computed(() => {
  const note = frequencyToNote(frequency.value)
  const detune = note.cents === 0 ? 'in tune' : `${note.cents > 0 ? '+' : ''}${note.cents}¢`
  return `${note.name}${note.octave} · ${detune}`
})

function toggle() {
  if (tone.isPlaying.value) tone.stop()
  else tone.play({ frequency: frequency.value, waveform: waveform.value, volume: volume.value })
}

function updateFrequency(value) {
  frequency.value = clampFrequency(value)
  tone.setFrequency(frequency.value)
}

function snapToNote() {
  const hz = noteToFrequency(pickNote.value, pickOctave.value)
  if (hz) updateFrequency(hz)
}

function updateWaveform(shape) {
  waveform.value = shape
  tone.setWaveform(shape)
}

function updateVolume(value) {
  volume.value = Number(value)
  tone.setVolume(volume.value)
}

function preset(hz) {
  updateFrequency(hz)
}

onMounted(() => preferences.recordRecent(TOOL_ID))
onBeforeUnmount(tone.dispose)
</script>
