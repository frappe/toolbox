<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <ToolPageHeader
      icon="lucide-mic"
      :category="categoryName"
      title="Audio Recorder"
      description="Record a voice note in your browser and save it to your device. Nothing is uploaded."
    />

    <section class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-5" aria-label="Recorder">
      <p v-if="!recorder.isSupported.value" class="flex items-center gap-2 text-sm text-ink-gray-6">
        <Icon name="lucide-mic-off" class="size-5 shrink-0 text-ink-gray-5" />
        Recording needs a browser with microphone support.
      </p>

      <template v-else>
        <!-- Idle: choose input, quality and destination, then record -->
        <div v-if="recorder.state.value === 'idle'" class="flex flex-col gap-5">
          <div class="grid gap-3 sm:grid-cols-2">
            <FormControl
              v-if="recorder.inputDevices.value.length > 1"
              type="select"
              size="md"
              label="Microphone"
              :options="deviceOptions"
              :model-value="selectedDeviceId"
              @update:model-value="selectedDeviceId = $event"
            />
            <FormControl
              type="select"
              size="md"
              label="Quality"
              :options="presetOptions"
              :model-value="selectedPresetId"
              @update:model-value="selectedPresetId = $event"
            />
          </div>
          <p class="text-xs leading-5 text-ink-gray-5">{{ activePreset.description }} Your browser picks the exact format, and it is shown once you stop.</p>

          <div class="flex flex-col gap-2">
            <Checkbox
              v-if="canStreamToDisk"
              v-model="streamToDisk"
              label="Record straight to a file on my device"
            />
            <p class="text-xs leading-5 text-ink-gray-5">
              <template v-if="canStreamToDisk && streamToDisk">
                You choose the file first, then audio is written to it as you speak. No length limit, and a crash cannot lose it.
              </template>
              <template v-else>
                The recording is held in this tab until you save it, so it stops at {{ limitMinutes }} minutes or {{ limitMegabytes }} MB.
              </template>
            </p>
          </div>

          <div class="flex flex-col items-center gap-3 py-1">
            <Button variant="solid" size="lg" icon-left="lucide-mic" label="Record" :loading="isStarting" @click="onStart" />
            <p class="text-xs text-ink-gray-5">Your browser will ask for microphone permission.</p>
          </div>
        </div>

        <!-- Recording / paused -->
        <div v-else-if="recorder.state.value === 'recording' || recorder.state.value === 'paused'" class="flex flex-col gap-4">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="relative flex size-3 shrink-0">
              <span v-if="recorder.state.value === 'recording'" class="absolute inline-flex size-full animate-ping rounded-full bg-surface-red-3 opacity-75 motion-reduce:hidden" />
              <span class="relative inline-flex size-3 rounded-full" :class="recorder.state.value === 'recording' ? 'bg-ink-red-4' : 'bg-ink-gray-5'" />
            </span>
            <span class="text-lg font-semibold tabular-nums text-ink-gray-9">{{ formatDuration(recorder.elapsed.value) }}</span>
            <span class="text-sm text-ink-gray-5">{{ recorder.state.value === 'paused' ? 'Paused' : 'Recording' }}</span>
            <span class="ml-auto text-sm tabular-nums text-ink-gray-5" role="status">
              <template v-if="recorder.isStreamingToDisk.value">{{ formatSize(recorder.bytes.value) }} written to your file</template>
              <template v-else>{{ formatDuration(recorder.remainingSeconds.value) }} left · {{ formatSize(recorder.bytes.value) }}</template>
            </span>
          </div>
          <canvas ref="waveformCanvas" width="600" height="56" class="h-14 w-full rounded-lg bg-surface-gray-2 text-ink-gray-7" role="img" aria-label="Live audio waveform" />
          <div class="h-2 w-full overflow-hidden rounded-full bg-surface-gray-3" role="meter" aria-label="Input level" :aria-valuenow="Math.round(recorder.level.value * 100)" aria-valuemin="0" aria-valuemax="100">
            <div class="h-full rounded-full bg-ink-gray-7 transition-[width] duration-100 motion-reduce:transition-none" :style="{ width: `${Math.round(recorder.level.value * 100)}%` }" />
          </div>
          <div class="flex flex-wrap gap-2">
            <Button v-if="recorder.state.value === 'recording'" variant="outline" icon-left="lucide-pause" label="Pause" @click="recorder.pause()" />
            <Button v-else variant="outline" icon-left="lucide-play" label="Resume" @click="recorder.resume()" />
            <Button variant="solid" icon-left="lucide-square" label="Stop" @click="recorder.stop()" />
            <Button variant="ghost" icon-left="lucide-x" label="Discard" @click="recorder.reset()" />
          </div>
        </div>

        <!-- Stopped: written straight to disk, so there is nothing held here -->
        <div v-else-if="recorder.isStreamingToDisk.value" class="flex flex-col gap-3">
          <p class="flex items-center gap-2 text-sm font-medium text-ink-gray-8">
            <Icon name="lucide-check" class="size-5 shrink-0 text-ink-green-8" />
            Saved to your file — {{ formatDuration(recorder.elapsed.value) }}, {{ formatSize(recorder.bytes.value) }}.
          </p>
          <p class="text-xs leading-5 text-ink-gray-5">Toolbox kept no copy. Open the file from wherever you saved it.</p>
          <div><Button variant="outline" icon-left="lucide-mic" label="Record another" @click="recorder.reset()" /></div>
        </div>

        <!-- Stopped: held in the tab, so offer preview, download and the editor -->
        <div v-else class="flex flex-col gap-3">
          <p class="text-sm font-medium text-ink-gray-7">
            Preview ({{ formatDuration(recorder.elapsed.value) }} · {{ formatSize(recorder.bytes.value) }}<template v-if="recordedFormat"> · {{ recordedFormat }}</template>)
          </p>
          <audio :src="recorder.url.value" controls class="w-full" />
          <p class="text-xs leading-5 text-ink-gray-5">This recording is only in this tab. Save it before you close or reload the page.</p>
          <div class="flex flex-wrap gap-2">
            <Button variant="solid" icon-left="lucide-download" label="Save to device" @click="onDownload" />
            <Button variant="outline" icon-left="lucide-audio-lines" label="Open in Audio Editor" @click="onOpenInEditor" />
            <Button variant="ghost" icon-left="lucide-trash-2" label="Discard" @click="recorder.reset()" />
          </div>
        </div>

        <Alert
          v-if="limitNotice"
          class="mt-4"
          theme="orange"
          :dismissible="false"
          :title="limitNotice"
        />
        <Alert v-if="recorder.error.value" class="mt-3" theme="red" :dismissible="false" :title="recorder.error.value" />
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Alert, Button, Checkbox, FormControl, Icon } from 'frappe-ui'
import { useRouter } from 'vue-router'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ToolPageHeader from '@/components/layout/ToolPageHeader.vue'
import { formatDuration, formatSize } from '@/tools/audio-recorder/audioFormat'
import { chooseFileSink, isFileSinkSupported, suggestedFileName } from '@/tools/audio-recorder/fileSink'
import { offerRecording } from '@/tools/audio-recorder/recordingHandoff'
import { RECORDER_PRESETS, DEFAULT_PRESET_ID, resolvePreset } from '@/tools/audio-recorder/recorderPresets'
import { getToolCategoryName } from '@/data/toolRegistry'
import {
  MAX_BYTES,
  MAX_DURATION_SECONDS,
  pickSupportedMime,
  useAudioRecorder,
  WAVEFORM_SIZE,
} from '@/tools/audio-recorder/useAudioRecorder'

const TOOL_ID = 'audio-recorder'

const categoryName = getToolCategoryName(TOOL_ID)
const preferences = useToolboxPreferences()
const recorder = useAudioRecorder()
const router = useRouter()

const canStreamToDisk = isFileSinkSupported()
const streamToDisk = ref(false)
const isStarting = ref(false)
const selectedDeviceId = ref('')
const selectedPresetId = ref(DEFAULT_PRESET_ID)

const limitMinutes = Math.round(MAX_DURATION_SECONDS / 60)
const limitMegabytes = Math.round(MAX_BYTES / (1024 * 1024))

const deviceOptions = computed(() => [
  { label: 'System default', value: '' },
  ...recorder.inputDevices.value.map((device) => ({ label: device.label, value: device.deviceId })),
])
const presetOptions = computed(() => RECORDER_PRESETS.map((preset) => ({ label: preset.label, value: preset.id })))
const activePreset = computed(() => resolvePreset(selectedPresetId.value))
// The browser's chosen codec/container, shown after a recording so we never promise a format.
const recordedFormat = computed(() => (recorder.mimeType.value || '').split(';')[0].replace('audio/', '').toUpperCase())

const limitNotice = computed(() => {
  if (recorder.limitReached.value === 'duration') {
    return `Recording stopped at the ${limitMinutes}-minute limit. Save it, then start another.`
  }
  if (recorder.limitReached.value === 'size') {
    return `Recording stopped at the ${limitMegabytes} MB limit. Save it, then start another.`
  }
  return ''
})

const waveformCanvas = ref(null)
const waveBuffer = new Uint8Array(WAVEFORM_SIZE)
const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
let waveRaf = null

function drawWaveform() {
  const canvas = waveformCanvas.value
  const ctx = canvas?.getContext('2d')
  if (ctx && recorder.readWaveform(waveBuffer)) {
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)
    ctx.lineWidth = 2
    ctx.strokeStyle = getComputedStyle(canvas).color
    ctx.beginPath()
    const step = width / waveBuffer.length
    for (let i = 0; i < waveBuffer.length; i += 1) {
      const y = (waveBuffer[i] / 255) * height
      const x = i * step
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  waveRaf = requestAnimationFrame(drawWaveform)
}

// Animate the waveform only while capturing; respect reduced-motion by leaving the level meter
// (which conveys the same state without motion) as the sole indicator.
watch(
  () => recorder.state.value,
  async (state) => {
    const capturing = state === 'recording' || state === 'paused'
    if (capturing && !prefersReducedMotion && waveRaf === null) {
      await nextTick()
      drawWaveform()
    } else if (!capturing && waveRaf !== null) {
      cancelAnimationFrame(waveRaf)
      waveRaf = null
    }
  },
)

onMounted(() => {
  preferences.recordRecent(TOOL_ID)
  void recorder.refreshDevices()
})

onBeforeUnmount(() => {
  if (waveRaf !== null) cancelAnimationFrame(waveRaf)
})

async function onStart() {
  isStarting.value = true
  try {
    // Ask for the destination before touching the microphone: the picker needs the click that is
    // still being handled, and a cancelled picker should not leave a live capture running. The
    // container has to be resolved up front too, so the file gets the right extension.
    let sink = null
    if (canStreamToDisk && streamToDisk.value) {
      sink = await chooseFileSink({ mimeType: pickSupportedMime() })
      if (!sink) return
    }
    await recorder.start({
      deviceId: selectedDeviceId.value,
      presetId: selectedPresetId.value,
      sink,
    })
  } catch {
    recorder.error.value = 'Could not open the file you chose, so recording did not start.'
  } finally {
    isStarting.value = false
  }
}

function onDownload() {
  const blob = recorder.blob.value
  if (!blob) return
  const link = document.createElement('a')
  link.href = recorder.url.value
  link.download = suggestedFileName(recorder.mimeType.value)
  link.click()
}

function onOpenInEditor() {
  if (!offerRecording(recorder.blob.value, { name: suggestedFileName(recorder.mimeType.value) })) return
  router.push('/audio-editor')
}
</script>
