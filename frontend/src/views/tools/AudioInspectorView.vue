<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-file-audio" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Media</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">Audio Inspector</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Check an audio file's duration, sample rate, channels and waveform — decoded locally, nothing uploaded.</p>
      </div>
    </header>

    <section v-if="state === 'empty' || state === 'error'" class="mt-8 rounded-2xl border border-dashed border-outline-gray-3 bg-surface-gray-1 p-8 text-center" aria-label="Choose audio">
      <Icon name="lucide-file-audio" class="mx-auto size-8 text-ink-gray-5" />
      <p class="mx-auto max-w-md pt-3 text-sm leading-6 text-ink-gray-6">Choose an audio file to inspect. Common formats your browser can decode (WAV, MP3, OGG, M4A) are supported.</p>
      <input ref="fileInput" type="file" accept="audio/*" class="hidden" @change="onFile" />
      <Button class="mt-4" variant="solid" icon-left="lucide-upload" label="Choose audio file" @click="fileInput?.click()" />
      <Alert v-if="error" class="mx-auto mt-4 max-w-md text-left" theme="red" :dismissible="false" :title="error" />
    </section>

    <div v-else-if="state === 'decoding'" class="mt-8 h-40 animate-pulse rounded-2xl bg-surface-gray-2 motion-reduce:animate-none" aria-hidden="true" />

    <template v-else>
      <section class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5 sm:p-6" aria-label="Audio details">
        <canvas ref="waveformCanvas" width="900" height="96" class="h-24 w-full rounded-lg bg-surface-gray-2 text-ink-gray-6" role="img" aria-label="Audio waveform" />
        <dl class="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div v-for="row in rows" :key="row.label" class="flex items-baseline justify-between gap-3 border-b border-outline-gray-2 pb-2">
            <dt class="text-sm text-ink-gray-6">{{ row.label }}</dt>
            <dd class="min-w-0 truncate text-sm font-medium text-ink-gray-9">{{ row.value }}</dd>
          </div>
        </dl>
        <p v-if="!hasHeader" class="mt-4 text-xs leading-5 text-ink-gray-5">Sample rate and bit depth are read from WAV headers. This file was decoded for its duration, channels and waveform.</p>
        <div class="mt-5">
          <Button variant="subtle" icon-left="lucide-rotate-ccw" label="Inspect another file" @click="reset" />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import { Alert, Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { computePeaks } from '@/tools/audio-editor/audioEdit'
import { describeAudio, parseWavHeader } from '@/tools/audio-inspector/audioInfo'

const TOOL_ID = 'audio-inspector'

const preferences = useToolboxPreferences()

const state = ref('empty') // empty | decoding | ready | error
const error = ref('')
const rows = ref([])
const peaks = ref(new Float32Array(0))
const hasHeader = ref(false)
const waveformCanvas = ref(null)
const fileInput = ref(null)

async function onFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  preferences.recordRecent(TOOL_ID)
  state.value = 'decoding'
  error.value = ''
  try {
    const arrayBuffer = await file.arrayBuffer()
    const header = parseWavHeader(arrayBuffer.slice(0, 4096))
    const Ctx = window.AudioContext || window.webkitAudioContext
    const context = new Ctx()
    const decoded = await context.decodeAudioData(arrayBuffer)
    const channels = []
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      channels.push(decoded.getChannelData(channel))
    }
    peaks.value = computePeaks(channels, 900)
    hasHeader.value = Boolean(header)
    rows.value = describeAudio(decoded, file, header)
    context.close?.()
    state.value = 'ready'
    await nextTick()
    drawWaveform()
  } catch {
    state.value = 'error'
    error.value = 'This file could not be decoded. Try a common audio format such as WAV, MP3 or OGG.'
  }
}

function drawWaveform() {
  const canvas = waveformCanvas.value
  const ctx = canvas?.getContext('2d')
  if (!ctx || !peaks.value.length) return
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = getComputedStyle(canvas).color
  const mid = height / 2
  const barWidth = width / peaks.value.length
  for (let i = 0; i < peaks.value.length; i += 1) {
    const barHeight = Math.max(1, peaks.value[i] * (height - 4))
    ctx.fillRect(i * barWidth, mid - barHeight / 2, Math.max(1, barWidth - 0.5), barHeight)
  }
}

function reset() {
  state.value = 'empty'
  error.value = ''
  rows.value = []
  peaks.value = new Float32Array(0)
  hasHeader.value = false
}
</script>
