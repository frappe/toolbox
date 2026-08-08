<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-mic" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Media</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">Audio Recorder</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Record a voice note in your browser and keep it in your private library.</p>
      </div>
    </header>

    <!-- Recorder -->
    <section class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-6" aria-label="Recorder">
      <p v-if="!recorder.isSupported.value" class="flex items-center gap-2 text-sm text-ink-gray-6">
        <Icon name="lucide-mic-off" class="size-5 shrink-0 text-ink-gray-5" />
        Recording needs a browser with microphone support. You can still play and manage saved recordings below.
      </p>

      <template v-else>
        <!-- Idle: choose input + quality, then record -->
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
          <p class="text-xs text-ink-gray-5">{{ activePreset.description }} The exact format is captured by your browser and shown after you stop.</p>
          <div class="flex flex-col items-center gap-3 py-1">
            <Button variant="solid" size="lg" icon="lucide-mic" label="Record" @click="onStart" />
            <p class="text-xs text-ink-gray-5">Your browser will ask for microphone permission.</p>
          </div>
        </div>

        <!-- Recording / paused -->
        <div v-else-if="recorder.state.value === 'recording' || recorder.state.value === 'paused'" class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <span class="relative flex size-3 shrink-0">
              <span v-if="recorder.state.value === 'recording'" class="absolute inline-flex size-full animate-ping rounded-full bg-surface-red-3 opacity-75 motion-reduce:hidden" />
              <span class="relative inline-flex size-3 rounded-full" :class="recorder.state.value === 'recording' ? 'bg-ink-red-4' : 'bg-ink-gray-5'" />
            </span>
            <span class="text-lg font-semibold tabular-nums text-ink-gray-9">{{ formatDuration(recorder.elapsed.value) }}</span>
            <span class="text-sm text-ink-gray-5">{{ recorder.state.value === 'paused' ? 'Paused' : 'Recording' }}</span>
          </div>
          <canvas ref="waveformCanvas" width="600" height="56" class="h-14 w-full rounded-lg bg-surface-gray-2 text-ink-gray-7" role="img" aria-label="Live audio waveform" />
          <div class="h-2 w-full overflow-hidden rounded-full bg-surface-gray-3" role="meter" aria-label="Input level" :aria-valuenow="Math.round(recorder.level.value * 100)" aria-valuemin="0" aria-valuemax="100">
            <div class="h-full rounded-full bg-ink-gray-7 transition-[width] duration-100 motion-reduce:transition-none" :style="{ width: `${Math.round(recorder.level.value * 100)}%` }" />
          </div>
          <div class="flex flex-wrap gap-2">
            <Button v-if="recorder.state.value === 'recording'" variant="outline" icon="lucide-pause" label="Pause" @click="recorder.pause()" />
            <Button v-else variant="outline" icon="lucide-play" label="Resume" @click="recorder.resume()" />
            <Button variant="solid" icon="lucide-square" label="Stop" @click="recorder.stop()" />
            <Button variant="ghost" icon="lucide-x" label="Discard" @click="recorder.reset()" />
          </div>
        </div>

        <!-- Stopped: preview + save -->
        <form v-else class="flex flex-col gap-3" @submit.prevent="onSave">
          <p class="text-sm font-medium text-ink-gray-7">Preview ({{ formatDuration(recorder.elapsed.value) }}<template v-if="recordedFormat"> · {{ recordedFormat }}</template>)</p>
          <audio :src="recorder.url.value" controls class="w-full" />
          <TextInput
            type="text"
            size="md"
            placeholder="Name this recording"
            aria-label="Recording title"
            :model-value="title"
            @update:model-value="title = $event"
          />
          <TextInput
            type="text"
            size="md"
            placeholder="Category (optional)"
            aria-label="Category"
            :model-value="category"
            @update:model-value="category = $event"
          />
          <TagInput variant="subtle" :model-value="tags" label="Tags" placeholder="Add a tag…" @update:model-value="tags = $event" />
          <div class="flex gap-2">
            <Button variant="solid" icon="lucide-save" :label="library.isSaving.value ? 'Saving…' : 'Save'" :loading="library.isSaving.value" type="submit" />
            <Button variant="ghost" icon="lucide-trash-2" label="Discard" @click="recorder.reset()" />
          </div>
        </form>

        <Alert v-if="recorder.error.value" class="mt-3" theme="red" :dismissible="false" :title="recorder.error.value" />
      </template>
      <Alert v-if="library.saveError.value" class="mt-3" theme="red" :dismissible="false" :title="library.saveError.value" />
    </section>

    <!-- Library -->
    <h2 class="mt-8 text-sm font-semibold uppercase tracking-wide text-ink-gray-5">Saved recordings</h2>

    <div v-if="library.state.value === 'error'" class="mt-3 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-8 text-center" role="alert">
      <Icon name="lucide-wifi-off" class="mx-auto size-7 text-ink-gray-5" />
      <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">{{ library.errorMessage.value }}</p>
      <Button class="mt-4" label="Try again" @click="library.load" />
    </div>

    <div v-else-if="library.state.value === 'loading'" class="mt-3 space-y-3" aria-hidden="true">
      <div v-for="row in 3" :key="row" class="h-16 animate-pulse rounded-xl bg-surface-gray-2 motion-reduce:animate-none" />
    </div>

    <p v-else-if="library.isEmpty.value" class="mt-3 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 px-4 py-10 text-center text-sm text-ink-gray-6">No recordings yet. Record one above and save it here.</p>

    <ul v-else class="mt-3 flex flex-col gap-2">
      <li v-for="rec in library.recordings.value" :key="rec.name" :data-recording-name="rec.name" class="rounded-xl border border-outline-gray-2 bg-surface-base p-3">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0 flex-1">
            <div v-if="editing === rec.name" class="flex flex-col gap-2">
              <TextInput
                type="text"
                size="sm"
                :aria-label="`Rename ${rec.title}`"
                :model-value="editTitle"
                @update:model-value="editTitle = $event"
                @keydown.enter.prevent="onUpdate(rec)"
              />
              <TextInput
                type="text"
                size="sm"
                placeholder="Category (optional)"
                aria-label="Edit category"
                :model-value="editCategory"
                @update:model-value="editCategory = $event"
              />
              <TagInput variant="subtle" :model-value="editTags" label="Tags" placeholder="Add a tag…" @update:model-value="editTags = $event" />
              <div class="flex gap-2">
                <Button variant="solid" label="Save" @click="onUpdate(rec)" />
                <Button variant="ghost" label="Cancel" @click="editing = null" />
              </div>
            </div>
            <template v-else>
              <p class="truncate text-sm font-medium text-ink-gray-9">{{ rec.title }}</p>
              <p class="mt-0.5 text-xs text-ink-gray-5">{{ formatDuration(rec.duration_seconds) }} · {{ formatSize(rec.file_size) }} · {{ rec.container_format }}<template v-if="rec.category"> · {{ rec.category }}</template></p>
              <div v-if="rec.tags && rec.tags.length" class="mt-1.5 flex flex-wrap gap-1" role="list" aria-label="Tags">
                <Badge v-for="tag in rec.tags" :key="tag" role="listitem" theme="gray" variant="subtle" size="sm" :label="tag" />
              </div>
            </template>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <Button variant="ghost" icon="lucide-pencil" aria-label="Edit recording" @click="startEdit(rec)" />
            <Button variant="ghost" icon="lucide-audio-lines" :aria-label="`Open ${rec.title} in the Audio Editor`" @click="openInEditor(rec)" />
            <a :href="rec.file" download class="flex size-8 items-center justify-center rounded text-ink-gray-6 transition hover:bg-surface-gray-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" :aria-label="`Download ${rec.title}`"><Icon name="lucide-download" class="size-4" /></a>
            <template v-if="confirmingDelete === rec.name">
              <span class="text-xs text-ink-gray-7">Delete?</span>
              <Button variant="ghost" label="Cancel" @click="confirmingDelete = null" />
              <Button variant="solid" theme="red" icon="lucide-trash-2" label="Delete" @click="onDelete(rec.name)" />
            </template>
            <Button v-else variant="ghost" icon="lucide-trash-2" aria-label="Delete recording" @click="confirmingDelete = rec.name" />
          </div>
        </div>
        <audio :src="rec.file" controls preload="none" class="mt-2 w-full" />
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Alert, Badge, Button, FormControl, Icon, TextInput } from 'frappe-ui'
import { useRouter } from 'vue-router'

import TagInput from '@/components/inputs/TagInput.vue'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { formatDuration, formatSize, useAudioLibrary } from '@/tools/audio-recorder/useAudioLibrary'
import { RECORDER_PRESETS, DEFAULT_PRESET_ID, resolvePreset } from '@/tools/audio-recorder/recorderPresets'
import { useAudioRecorder, WAVEFORM_SIZE } from '@/tools/audio-recorder/useAudioRecorder'

const TOOL_ID = 'audio-recorder'

const preferences = useToolboxPreferences()
const recorder = useAudioRecorder()
const library = useAudioLibrary()
const router = useRouter()

const deviceOptions = computed(() => [
  { label: 'System default', value: '' },
  ...recorder.inputDevices.value.map((device) => ({ label: device.label, value: device.deviceId })),
])
const presetOptions = computed(() => RECORDER_PRESETS.map((preset) => ({ label: preset.label, value: preset.id })))

function openInEditor(rec) {
  router.push({ path: '/audio-editor', query: { asset: rec.name } })
}

const selectedDeviceId = ref('')
const selectedPresetId = ref(DEFAULT_PRESET_ID)
const title = ref('')
const category = ref('')
const tags = ref([])
const editing = ref(null)
const editTitle = ref('')
const editCategory = ref('')
const editTags = ref([])
const confirmingDelete = ref(null)

const activePreset = computed(() => resolvePreset(selectedPresetId.value))
// The browser's chosen codec/container, shown after a recording so we never promise a format.
const recordedFormat = computed(() => (recorder.mimeType.value || '').split(';')[0].replace('audio/', '').toUpperCase())

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
  void library.load()
  void recorder.refreshDevices()
})

onBeforeUnmount(() => {
  if (waveRaf !== null) cancelAnimationFrame(waveRaf)
})

function onStart() {
  void recorder.start({ deviceId: selectedDeviceId.value, presetId: selectedPresetId.value })
}

async function onSave() {
  const saved = await library.saveBlob(recorder.blob.value, {
    title: title.value,
    durationSeconds: recorder.durationSeconds.value,
    category: category.value.trim(),
    tags: tags.value,
  })
  if (saved) {
    title.value = ''
    category.value = ''
    tags.value = []
    recorder.reset()
  }
}

function startEdit(rec) {
  confirmingDelete.value = null
  editing.value = rec.name
  editTitle.value = rec.title
  editCategory.value = rec.category || ''
  editTags.value = [...(rec.tags || [])]
}

async function onUpdate(rec) {
  const ok = await library.update(rec.name, {
    title: editTitle.value.trim() || rec.title,
    category: editCategory.value.trim(),
    tags: editTags.value,
  })
  if (ok) editing.value = null
}

async function onDelete(name) {
  await library.remove(name)
  confirmingDelete.value = null
}
</script>
