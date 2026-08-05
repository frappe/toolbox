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
      <Button variant="subtle" icon="lucide-star" :label="preferences.isFavourite(TOOL_ID) ? 'Favourited' : 'Favourite'" @click="preferences.toggleFavourite(TOOL_ID)" />
    </header>

    <!-- Empty: choose a file -->
    <section v-if="editor.state.value === 'empty' || editor.state.value === 'error'" class="mt-8 rounded-2xl border border-dashed border-outline-gray-3 bg-surface-gray-1 p-8 text-center" aria-label="Import audio">
      <Icon name="lucide-file-audio" class="mx-auto size-8 text-ink-gray-5" />
      <p class="mx-auto max-w-md pt-3 text-sm leading-6 text-ink-gray-6">Choose an audio file to edit. Common formats your browser can decode (WAV, MP3, OGG, M4A) are supported.</p>
      <label class="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-surface-gray-7 px-4 py-2 text-sm font-medium text-white outline-none focus-within:ring-2 focus-within:ring-outline-gray-3 hover:bg-surface-gray-6">
        <Icon name="lucide-upload" class="size-4" />
        Choose audio file
        <input type="file" accept="audio/*" class="sr-only" @change="onFile" />
      </label>
      <p v-if="editor.error.value" class="mx-auto mt-4 max-w-md rounded-lg bg-surface-red-1 px-3 py-2 text-sm text-ink-red-4" role="alert">{{ editor.error.value }}</p>
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

        <!-- Trim -->
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="grid gap-1.5 text-sm font-medium text-ink-gray-7">
            <span class="flex justify-between"><span>Start</span><span class="tabular-nums text-ink-gray-5">{{ formatTime(editor.project.value.trimStart) }}</span></span>
            <input type="range" min="0" :max="editor.source.value.duration" step="0.01" :value="editor.project.value.trimStart" aria-label="Trim start" @change="setTrimStart($event.target.value)" />
          </label>
          <label class="grid gap-1.5 text-sm font-medium text-ink-gray-7">
            <span class="flex justify-between"><span>End</span><span class="tabular-nums text-ink-gray-5">{{ formatTime(editor.project.value.trimEnd) }}</span></span>
            <input type="range" min="0" :max="editor.source.value.duration" step="0.01" :value="editor.project.value.trimEnd" aria-label="Trim end" @change="setTrimEnd($event.target.value)" />
          </label>
        </div>

        <!-- Fades + gain -->
        <div class="mt-4 grid gap-4 sm:grid-cols-3">
          <label class="grid gap-1.5 text-sm font-medium text-ink-gray-7">
            Fade in (s)
            <input type="number" min="0" :max="maxFade" step="0.1" :value="editor.project.value.fadeIn" aria-label="Fade in seconds" class="h-10 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3" @change="setFade('fadeIn', $event.target.value)" />
          </label>
          <label class="grid gap-1.5 text-sm font-medium text-ink-gray-7">
            Fade out (s)
            <input type="number" min="0" :max="maxFade" step="0.1" :value="editor.project.value.fadeOut" aria-label="Fade out seconds" class="h-10 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3" @change="setFade('fadeOut', $event.target.value)" />
          </label>
          <label class="grid gap-1.5 text-sm font-medium text-ink-gray-7">
            <span class="flex justify-between"><span>Gain</span><span class="tabular-nums text-ink-gray-5">{{ gainLabel }}</span></span>
            <input type="range" min="-24" max="12" step="1" :value="editor.project.value.gainDb" aria-label="Gain in decibels" @change="editor.update({ gainDb: Number($event.target.value) })" />
          </label>
        </div>
      </section>

      <!-- Preview + export -->
      <section class="mt-4 rounded-2xl border border-outline-gray-2 bg-surface-base p-4 sm:p-6" aria-label="Preview and export">
        <div class="flex flex-wrap items-center gap-3">
          <Button variant="outline" icon-left="lucide-play" label="Preview edit" @click="buildPreview" />
          <p class="text-sm text-ink-gray-6">Output: <span class="font-medium text-ink-gray-8 tabular-nums">{{ formatTime(editor.outputDuration.value) }}</span> · <span class="tabular-nums">{{ formatSize(estimatedSize) }}</span> WAV</p>
        </div>
        <audio v-if="previewUrl" :src="previewUrl" controls class="mt-3 w-full" />

        <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label class="grid flex-1 gap-1.5 text-sm font-medium text-ink-gray-7">
            Save to your library
            <input v-model="saveTitle" type="text" placeholder="Name this clip" aria-label="Saved clip title" class="h-10 min-w-0 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3" />
          </label>
          <div class="flex gap-2">
            <Button variant="solid" icon-left="lucide-save" :label="library.isSaving.value ? 'Saving…' : 'Save'" :loading="library.isSaving.value" :disabled="editor.outputDuration.value <= 0" @click="onSave" />
            <Button variant="subtle" icon-left="lucide-download" label="Download WAV" :disabled="editor.outputDuration.value <= 0" @click="onDownload" />
          </div>
        </div>
        <p v-if="savedTitle" class="mt-3 flex items-center gap-2 rounded-lg bg-surface-green-1 px-3 py-2 text-sm text-ink-green-7" role="status"><Icon name="lucide-check" class="size-4" /> Saved “{{ savedTitle }}” to your Audio Recorder library.</p>
        <p v-if="library.saveError.value" class="mt-3 rounded-lg bg-surface-red-1 px-3 py-2 text-sm text-ink-red-4" role="alert">{{ library.saveError.value }}</p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { formatSize, useAudioLibrary } from '@/tools/audio-recorder/useAudioLibrary'
import { useAudioEditor } from '@/tools/audio-editor/useAudioEditor'

const TOOL_ID = 'audio-editor'

const preferences = useToolboxPreferences()
const editor = useAudioEditor()
const library = useAudioLibrary()

const waveformCanvas = ref(null)
const previewUrl = ref('')
const saveTitle = ref('')
const savedTitle = ref('')

const maxFade = computed(() => Math.max(0, editor.outputDuration.value))
const gainLabel = computed(() => {
  const db = editor.project.value?.gainDb ?? 0
  return `${db > 0 ? '+' : ''}${db} dB`
})
const estimatedSize = computed(() => {
  const source = editor.source.value
  if (!source) return 0
  const frames = Math.round(editor.outputDuration.value * source.sampleRate)
  return 44 + frames * source.channels.length * 2
})

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

function onDownload() {
  const blob = editor.renderBlob()
  if (!blob) return
  const base = (saveTitle.value.trim() || editor.source.value.name || 'audio').replace(/\.[^.]+$/, '')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${base}-edited.wav`
  link.click()
  URL.revokeObjectURL(url)
}

async function onSave() {
  const blob = editor.renderBlob()
  if (!blob) return
  savedTitle.value = ''
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
