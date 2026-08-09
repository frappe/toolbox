<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-audio-lines" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Media</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">Audio Editor</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Trim, fade and adjust a clip in your browser, then export a clean WAV. Nothing leaves your device until you save.</p>
      </div>
    </header>

    <!-- Empty: choose a file -->
    <section v-if="editor.state.value === 'empty' || editor.state.value === 'error'" class="mt-8 rounded-2xl border border-dashed border-outline-gray-3 bg-surface-gray-1 p-8 text-center" aria-label="Import audio">
      <Icon name="lucide-file-audio" class="mx-auto size-8 text-ink-gray-5" />
      <p class="mx-auto max-w-md pt-3 text-sm leading-6 text-ink-gray-6">Choose an audio file to edit. Common formats your browser can decode (WAV, MP3, OGG, M4A) are supported.</p>
      <input ref="fileInput" type="file" accept="audio/*" class="hidden" @change="onFile" />
      <Button class="mt-4" variant="solid" icon-left="lucide-upload" label="Choose audio file" @click="fileInput?.click()" />
      <Alert v-if="editor.error.value" class="mx-auto mt-4 max-w-md text-left" theme="red" :dismissible="false" :title="editor.error.value" />
    </section>

    <div v-else-if="editor.state.value === 'decoding'" class="mt-8 h-40 animate-pulse rounded-2xl bg-surface-gray-2 motion-reduce:animate-none" aria-hidden="true" />

    <!-- Ready: edit -->
    <template v-else>
      <section class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-6" aria-label="Editor">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="min-w-0 truncate text-sm font-medium text-ink-gray-8">{{ editor.source.value.name }}</p>
          <div class="flex items-center gap-1.5">
            <Button variant="ghost" icon="lucide-undo-2" aria-label="Undo" :disabled="!editor.canUndo.value" @click="editor.undo()" />
            <Button variant="ghost" icon="lucide-redo-2" aria-label="Redo" :disabled="!editor.canRedo.value" @click="editor.redo()" />
            <Button variant="ghost" icon-left="lucide-rotate-ccw" label="Start over" @click="onReset" />
          </div>
        </div>

        <canvas ref="waveformCanvas" width="900" height="112" class="mt-4 h-28 w-full rounded-lg bg-surface-gray-2 text-ink-gray-7" role="img" aria-label="Audio waveform with the selected region highlighted" />

        <!-- Trim. Slider's model is an array; a scalar falls back to `[min]` and pins the thumb (#143). -->
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <Slider
            label="Start"
            :description="formatTime(editor.project.value.trimStart)"
            :min="0"
            :max="editor.source.value.duration"
            :step="0.01"
            aria-label="Trim start"
            :model-value="[editor.project.value.trimStart]"
            @update:model-value="setTrimStart($event[0])"
          />
          <Slider
            label="End"
            :description="formatTime(editor.project.value.trimEnd)"
            :min="0"
            :max="editor.source.value.duration"
            :step="0.01"
            aria-label="Trim end"
            :model-value="[editor.project.value.trimEnd]"
            @update:model-value="setTrimEnd($event[0])"
          />
        </div>

        <!-- Fades + gain -->
        <div class="mt-4 grid gap-4 sm:grid-cols-3">
          <FormControl
            type="number"
            size="md"
            label="Fade in (s)"
            min="0"
            :max="maxFade"
            step="0.1"
            aria-label="Fade in seconds"
            :model-value="editor.project.value.fadeIn"
            @update:model-value="setFade('fadeIn', $event)"
          />
          <FormControl
            type="number"
            size="md"
            label="Fade out (s)"
            min="0"
            :max="maxFade"
            step="0.1"
            aria-label="Fade out seconds"
            :model-value="editor.project.value.fadeOut"
            @update:model-value="setFade('fadeOut', $event)"
          />
          <Slider
            label="Gain"
            :description="gainLabel"
            :min="-24"
            :max="12"
            :step="1"
            aria-label="Gain in decibels"
            :model-value="[editor.project.value.gainDb]"
            @update:model-value="editor.update({ gainDb: Number($event[0]) })"
          />
        </div>
      </section>

      <!-- Preview + export -->
      <section class="mt-4 rounded-2xl border border-outline-gray-2 bg-surface-base p-4 sm:p-6" aria-label="Preview and export">
        <div class="flex flex-wrap items-center gap-3">
          <Button variant="outline" icon-left="lucide-play" label="Preview edit" @click="buildPreview" />
          <p class="text-sm text-ink-gray-6">Output: <span class="font-medium text-ink-gray-8 tabular-nums">{{ formatTime(editor.outputDuration.value) }}</span> · <span class="tabular-nums">≈{{ formatSize(estimatedSize) }}</span> {{ formatLabel }}</p>
        </div>
        <audio v-if="previewUrl" :src="previewUrl" controls class="mt-3 w-full" />

        <div v-if="opusAvailable" class="mt-4 grid gap-2 text-sm font-medium text-ink-gray-7">
          <span>Export format</span>
          <div class="overflow-x-auto">
            <TabButtons
              :options="formatOptions"
              :model-value="exportFormat"
              size="md"
              aria-label="Export format"
              @update:model-value="exportFormat = $event"
            />
          </div>
        </div>

        <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <FormControl
            type="text"
            size="md"
            class="flex-1"
            label="Save to your library"
            placeholder="Name this clip"
            aria-label="Saved clip title"
            :model-value="saveTitle"
            @update:model-value="saveTitle = $event"
          />
          <div class="flex gap-2">
            <Button variant="solid" icon-left="lucide-save" :label="library.isSaving.value || encoding ? 'Saving…' : 'Save'" :loading="library.isSaving.value || encoding" :disabled="editor.outputDuration.value <= 0 || encoding" @click="onSave" />
            <Button variant="subtle" icon-left="lucide-download" :label="downloadLabel" :loading="encoding" :disabled="editor.outputDuration.value <= 0 || encoding" @click="onDownload" />
          </div>
        </div>
        <p v-if="encoding" class="mt-3 text-sm text-ink-gray-6">Encoding to Opus… this runs in real time, so it takes about the length of the clip.</p>
        <Alert v-if="savedTitle" class="mt-3" theme="green" :dismissible="false" :title="`Saved “${savedTitle}” to your Audio Recorder library.`" />
        <Alert v-if="library.saveError.value" class="mt-3" theme="red" :dismissible="false" :title="library.saveError.value" />
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Alert, Button, FormControl, Icon, Slider, TabButtons } from 'frappe-ui'
import { useRoute } from 'vue-router'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { getRecording } from '@/tools/audio-recorder/api'
import { formatSize, useAudioLibrary } from '@/tools/audio-recorder/useAudioLibrary'
import { useAudioEditor } from '@/tools/audio-editor/useAudioEditor'
import { canEncodeOpus, encodeOpus, OPUS_BITS_PER_SECOND } from '@/tools/audio-editor/webmEncode'

const TOOL_ID = 'audio-editor'
const FORMATS = [
  { id: 'wav', label: 'WAV (lossless)' },
  { id: 'webm', label: 'Compressed (Opus)' },
]

const preferences = useToolboxPreferences()
const editor = useAudioEditor()
const library = useAudioLibrary()
const route = useRoute()

// Opened from a saved recording via ?asset=<name>: fetch the private file and load it.
onMounted(() => {
  const assetName = route.query.asset
  if (assetName) {
    preferences.recordRecent(TOOL_ID)
    void loadAsset(String(assetName))
  }
})

async function loadAsset(name) {
  try {
    const asset = await getRecording(name)
    const response = await fetch(asset.file)
    if (!response.ok) throw new Error(`Fetch failed (${response.status})`)
    const blob = await response.blob()
    const extension = (asset.container_format || 'audio').replace('mp4', 'm4a')
    await editor.load(new File([blob], `${asset.title || 'recording'}.${extension}`, { type: asset.mime || blob.type }))
  } catch {
    // Leave the editor in its empty state so the user can pick a file manually.
  }
}

const waveformCanvas = ref(null)
const fileInput = ref(null)
const previewUrl = ref('')
const saveTitle = ref('')
const savedTitle = ref('')
const exportFormat = ref('wav')
const encoding = ref(false)
const opusAvailable = canEncodeOpus()

const formatOptions = computed(() => FORMATS.map((format) => ({ label: format.label, value: format.id })))

const maxFade = computed(() => Math.max(0, editor.outputDuration.value))
const gainLabel = computed(() => {
  const db = editor.project.value?.gainDb ?? 0
  return `${db > 0 ? '+' : ''}${db} dB`
})
const formatLabel = computed(() => (exportFormat.value === 'webm' ? 'WebM · Opus' : 'WAV'))
const downloadLabel = computed(() => (encoding.value ? 'Encoding…' : exportFormat.value === 'webm' ? 'Download Opus' : 'Download WAV'))
const estimatedSize = computed(() => {
  const source = editor.source.value
  if (!source) return 0
  if (exportFormat.value === 'webm') return Math.round((editor.outputDuration.value * OPUS_BITS_PER_SECOND) / 8)
  const frames = Math.round(editor.outputDuration.value * source.sampleRate)
  return 44 + frames * source.channels.length * 2
})

// Render the current edit to the chosen format. WAV is instant; Opus encodes in real time.
async function exportBlob() {
  if (exportFormat.value === 'webm') {
    const planar = editor.renderPlanar()
    return planar ? encodeOpus(planar) : null
  }
  return editor.renderBlob()
}

// Redraw the waveform (and the highlighted region) whenever the audio or the trim changes.
watch(
  () => [editor.peaks.value, editor.project.value?.trimStart, editor.project.value?.trimEnd],
  () => drawWaveform(),
  { deep: false, flush: 'post' },
)

function drawWaveform() {
  const canvas = waveformCanvas.value
  const ctx = canvas?.getContext('2d')
  const peaks = editor.peaks.value
  if (!ctx || !peaks.length) return
  const { width, height } = canvas
  const source = editor.source.value
  const project = editor.project.value
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = getComputedStyle(canvas).color
  const mid = height / 2
  const barWidth = width / peaks.length
  const duration = source?.duration || 1
  const startX = (project.trimStart / duration) * width
  const endX = (project.trimEnd / duration) * width
  for (let i = 0; i < peaks.length; i += 1) {
    const x = i * barWidth
    const barHeight = Math.max(1, peaks[i] * (height - 4))
    ctx.globalAlpha = x >= Math.min(startX, endX) && x <= Math.max(startX, endX) ? 1 : 0.28
    ctx.fillRect(x, mid - barHeight / 2, Math.max(1, barWidth - 0.5), barHeight)
  }
  ctx.globalAlpha = 1
}

function onFile(event) {
  const file = event.target.files?.[0]
  if (file) {
    preferences.recordRecent(TOOL_ID)
    void editor.load(file)
  }
  event.target.value = ''
}

function setTrimStart(value) {
  editor.update({ trimStart: Math.max(0, Math.min(Number(value), editor.project.value.trimEnd)) })
  clearPreview()
}

function setTrimEnd(value) {
  editor.update({ trimEnd: Math.min(editor.source.value.duration, Math.max(Number(value), editor.project.value.trimStart)) })
  clearPreview()
}

function setFade(key, value) {
  editor.update({ [key]: Math.max(0, Math.min(Number(value) || 0, maxFade.value)) })
  clearPreview()
}

function buildPreview() {
  clearPreview()
  const blob = editor.renderBlob()
  previewUrl.value = blob ? URL.createObjectURL(blob) : ''
}

async function onDownload() {
  if (encoding.value) return
  encoding.value = exportFormat.value === 'webm'
  try {
    const blob = await exportBlob()
    if (!blob) return
    const base = (saveTitle.value.trim() || editor.source.value.name || 'audio').replace(/\.[^.]+$/, '')
    const extension = exportFormat.value === 'webm' ? 'webm' : 'wav'
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${base}-edited.${extension}`
    link.click()
    URL.revokeObjectURL(url)
  } finally {
    encoding.value = false
  }
}

async function onSave() {
  if (encoding.value) return
  savedTitle.value = ''
  encoding.value = exportFormat.value === 'webm'
  let blob
  try {
    blob = await exportBlob()
  } finally {
    encoding.value = false
  }
  if (!blob) return
  const saved = await library.saveBlob(blob, {
    title: saveTitle.value.trim() || (editor.source.value.name || 'Edited audio').replace(/\.[^.]+$/, ''),
    durationSeconds: editor.outputDuration.value,
    sourceType: 'Edited',
    createdFromTool: 'editor',
  })
  if (saved) {
    savedTitle.value = saved.title
    saveTitle.value = ''
  }
}

function onReset() {
  clearPreview()
  savedTitle.value = ''
  saveTitle.value = ''
  editor.reset()
}

function clearPreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
}

function formatTime(seconds) {
  const total = Math.max(0, Number(seconds) || 0)
  const mins = Math.floor(total / 60)
  const secs = Math.floor(total % 60)
  const tenths = Math.floor((total * 10) % 10)
  return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`
}

onBeforeUnmount(clearPreview)
</script>
