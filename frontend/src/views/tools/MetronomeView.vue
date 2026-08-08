<template>
  <div class="mx-auto w-full max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-drum" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Media</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">Metronome</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Keep time with an accurate click, generated locally in your browser.</p>
      </div>
    </header>

    <Alert v-if="!metro.isSupported.value" class="mt-8" :dismissible="false" title="The metronome needs a browser with the Web Audio API." />

    <section v-else class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5 sm:p-6" aria-label="Metronome">
      <!-- Beat indicator -->
      <div class="flex justify-center gap-2.5 py-2" aria-hidden="true">
        <span
          v-for="index in beatsPerMeasure"
          :key="index"
          class="size-4 rounded-full transition-all duration-75 motion-reduce:transition-none"
          :class="beatClass(index - 1)"
        />
      </div>

      <!-- Tempo -->
      <div class="flex flex-col items-center gap-1 pt-4">
        <p class="text-6xl font-semibold tabular-nums text-ink-gray-9">{{ bpm }}</p>
        <p class="text-sm text-ink-gray-6">BPM · <span class="font-medium text-ink-gray-8">{{ term }}</span></p>
      </div>

      <div class="mt-5 flex items-center justify-center gap-3">
        <Button variant="outline" icon="lucide-minus" aria-label="Decrease tempo" @click="nudge(-1)" />
        <Slider
          class="w-48 sm:w-64"
          :min="MIN_BPM"
          :max="MAX_BPM"
          :step="1"
          aria-label="Tempo in BPM"
          :model-value="bpm"
          @update:model-value="updateBpm"
        />
        <Button variant="outline" icon="lucide-plus" aria-label="Increase tempo" @click="nudge(1)" />
      </div>

      <div class="mt-6 flex flex-col items-center gap-3">
        <Button
          size="lg"
          :variant="metro.isPlaying.value ? 'outline' : 'solid'"
          :icon-left="metro.isPlaying.value ? 'lucide-square' : 'lucide-play'"
          :label="metro.isPlaying.value ? 'Stop' : 'Start'"
          @click="toggle"
        />
        <Button variant="ghost" icon-left="lucide-hand" label="Tap tempo" @click="tap" />
      </div>

      <div class="mt-8 grid gap-5 sm:grid-cols-2">
        <FormControl
          type="select"
          size="md"
          label="Beats per measure"
          :options="beatsOptions"
          :model-value="beatsPerMeasure"
          @update:model-value="(value) => { beatsPerMeasure = value; metro.setBeatsPerMeasure(value) }"
        />
        <Slider
          label="Volume"
          :description="`${Math.round(volume * 100)}%`"
          :min="0"
          :max="1"
          :step="0.01"
          aria-label="Volume"
          :model-value="volume"
          @update:model-value="updateVolume"
        />
      </div>

      <p class="mt-6 text-xs leading-5 text-ink-gray-5">The click is scheduled on the audio clock for steady timing. Everything runs locally — nothing is recorded or sent.</p>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Alert, Button, FormControl, Icon, Slider } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { useMetronome } from '@/tools/metronome/useMetronome'
import { BEATS_PER_MEASURE_OPTIONS, clampBpm, MAX_BPM, MIN_BPM, tapTempoBpm, tempoTerm } from '@/tools/metronome/metronome'

const TOOL_ID = 'metronome'
const beatsOptions = BEATS_PER_MEASURE_OPTIONS.map((option) => ({ label: String(option), value: option }))

const preferences = useToolboxPreferences()
const metro = useMetronome()

const bpm = ref(120)
const beatsPerMeasure = ref(4)
const volume = ref(0.5)
let tapTimes = []

const term = computed(() => tempoTerm(bpm.value))

function beatClass(index) {
  const active = metro.currentBeat.value === index
  if (index === 0) return active ? 'scale-125 bg-ink-gray-9' : 'bg-surface-gray-4'
  return active ? 'scale-110 bg-ink-gray-7' : 'bg-surface-gray-3'
}

function toggle() {
  if (metro.isPlaying.value) metro.stop()
  else metro.start()
}

function updateBpm(value) {
  bpm.value = clampBpm(value)
  metro.setBpm(bpm.value)
}

function nudge(delta) {
  updateBpm(bpm.value + delta)
}

function updateVolume(value) {
  volume.value = Number(value)
  metro.setVolume(volume.value)
}

// Tap a steady beat to set the tempo; keep only recent taps so a fresh tapping resets cleanly.
function tap() {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > 2000) tapTimes = []
  tapTimes.push(now)
  const tapped = tapTempoBpm(tapTimes)
  if (tapped) updateBpm(tapped)
}

onMounted(() => {
  preferences.recordRecent(TOOL_ID)
  metro.setBpm(bpm.value)
  metro.setBeatsPerMeasure(beatsPerMeasure.value)
  metro.setVolume(volume.value)
})
onBeforeUnmount(metro.dispose)
</script>
