<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-notebook-pen" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Capture</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">Notes</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Write rich notes that save as you type.</p>
      </div>
    </header>

    <div v-if="notes.state.value === 'error'" class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-8 text-center" role="alert">
      <Icon name="lucide-wifi-off" class="mx-auto size-7 text-ink-gray-5" />
      <h2 class="pt-3 text-base font-semibold text-ink-gray-9">Your notes could not be loaded</h2>
      <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">{{ notes.errorMessage.value }}</p>
      <Button class="mt-4" label="Try again" @click="notes.loadList" />
    </div>

    <div v-else-if="notes.state.value === 'loading'" class="mt-8 space-y-3" aria-hidden="true">
      <div v-for="row in 4" :key="row" class="h-16 animate-pulse rounded-xl bg-surface-gray-2 motion-reduce:animate-none" />
    </div>

    <section v-else-if="notes.notes.value.length === 0 && !notes.activeNote.value" class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-10 text-center">
      <Icon name="lucide-file-pen-line" class="mx-auto size-8 text-ink-gray-5" />
      <h2 class="pt-3 text-lg font-semibold text-ink-gray-9">No notes yet</h2>
      <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">Jot down an idea, a meeting summary, or anything you want to keep. It saves as you write.</p>
      <Button class="mt-5" variant="solid" icon="lucide-plus" label="New note" @click="onCreate" />
    </section>

    <div v-else class="mt-8 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <!-- List pane -->
      <aside class="min-w-0 flex-col gap-4" :class="notes.activeNote.value ? 'hidden lg:flex' : 'flex'" aria-label="Your notes">
        <Button variant="solid" icon="lucide-plus" label="New note" @click="onCreate" />

        <div class="relative">
          <Icon name="lucide-search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-gray-5" />
          <input v-model="notes.searchQuery.value" type="search" autocomplete="off" spellcheck="false" placeholder="Search notes" aria-label="Search notes" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base pl-9 pr-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
        </div>

        <label class="flex items-center gap-2 text-sm text-ink-gray-7">
          <input v-model="notes.showArchived.value" type="checkbox" class="size-4 rounded border-outline-gray-3 text-ink-gray-9 focus-visible:ring-2 focus-visible:ring-outline-gray-3" />
          Show archived
        </label>

        <ul v-if="notes.filteredNotes.value.length" class="flex flex-col gap-1.5" aria-label="Note list">
          <li v-for="row in notes.filteredNotes.value" :key="row.name">
            <button type="button" :data-note-name="row.name" :aria-current="row.name === activeName" class="flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition motion-reduce:transition-none" :class="rowClass(row)" @click="notes.openNote(row.name)">
              <Icon v-if="row.is_pinned" name="lucide-pin" class="mt-0.5 size-4 shrink-0 text-ink-gray-6" aria-hidden="true" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-ink-gray-8">{{ row.title || 'Untitled note' }}</span>
                <span v-if="row.excerpt" class="mt-0.5 block truncate text-xs text-ink-gray-5">{{ row.excerpt }}</span>
                <span v-if="row.is_archived" class="text-xs text-ink-gray-5">Archived</span>
              </span>
            </button>
          </li>
        </ul>
        <p v-else class="rounded-xl border border-outline-gray-2 bg-surface-gray-1 px-3 py-6 text-center text-sm text-ink-gray-6">No notes match your search.</p>
      </aside>

      <!-- Detail pane -->
      <section class="min-w-0" :class="notes.activeNote.value ? 'block' : 'hidden lg:block'" aria-label="Note detail">
        <div v-if="!notes.activeNote.value" class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-10 text-center">
          <Icon name="lucide-notebook-text" class="mx-auto size-7 text-ink-gray-5" />
          <h2 class="pt-3 text-base font-semibold text-ink-gray-8">Select a note</h2>
          <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">Pick a note from the list to read and edit it.</p>
        </div>

        <div v-else class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-6">
          <div class="flex items-center gap-3">
            <Button class="lg:hidden" variant="ghost" icon="lucide-arrow-left" aria-label="Back to list" @click="notes.closeActive" />
            <span class="flex-1 text-xs text-ink-gray-5" role="status" aria-live="polite">{{ saveStatus }}</span>
          </div>

          <label for="note-title" class="sr-only">Note title</label>
          <input id="note-title" :value="active.title" type="text" placeholder="Untitled note" class="mt-2 w-full rounded-lg border border-transparent bg-transparent px-1 text-xl font-semibold text-ink-gray-9 outline-none transition hover:border-outline-gray-2 focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @input="notes.setTitle($event.target.value)" />

          <!-- Editor -->
          <div class="mt-3">
            <p id="note-editor-label" class="sr-only">Note content</p>
            <TextEditor
              v-if="hasRichEditor"
              :key="active.name"
              :content="active.content_html"
              :fixed-menu="true"
              :bubble-menu="true"
              editor-class="prose-sm max-w-none"
              placeholder="Start writing…"
              class="min-h-48 rounded-lg border border-outline-gray-2 bg-surface-base px-3 py-2 focus-within:border-outline-gray-3 focus-within:ring-2 focus-within:ring-outline-gray-3"
              @change="notes.setContentHtml($event)"
            />
            <div
              v-else
              ref="fallbackEditor"
              contenteditable="true"
              role="textbox"
              aria-multiline="true"
              aria-labelledby="note-editor-label"
              class="prose prose-sm min-h-48 max-w-none rounded-lg border border-outline-gray-2 bg-surface-base px-3 py-2 text-sm text-ink-gray-9 outline-none focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3"
              @input="notes.setContentHtml($event.target.innerHTML)"
            />
          </div>

          <div class="mt-3">
            <TagInput :model-value="active.tags" label="Tags" placeholder="Add a tag…" @update:model-value="notes.setTags($event)" />
          </div>

          <!-- Actions -->
          <div class="mt-5 flex flex-wrap items-center gap-2 border-t border-outline-gray-2 pt-4">
            <Button variant="outline" :icon="active.is_pinned ? 'lucide-pin-off' : 'lucide-pin'" :label="active.is_pinned ? 'Unpin' : 'Pin'" @click="notes.togglePin" />
            <Button variant="outline" :icon="active.is_archived ? 'lucide-archive-restore' : 'lucide-archive'" :label="active.is_archived ? 'Unarchive' : 'Archive'" @click="notes.toggleArchive" />
            <Button variant="outline" icon="lucide-copy" label="Duplicate" @click="notes.duplicateActive" />

            <div class="relative">
              <Button variant="outline" icon="lucide-download" label="Export" aria-haspopup="menu" :aria-expanded="showExportMenu" @click="showExportMenu = !showExportMenu" />
              <div v-if="showExportMenu" class="absolute z-10 mt-1 w-40 rounded-lg border border-outline-gray-2 bg-surface-base p-1 shadow-lg" role="menu">
                <button type="button" role="menuitem" class="w-full rounded px-3 py-2 text-left text-sm text-ink-gray-8 hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" @click="onExport('markdown')">Markdown</button>
                <button type="button" role="menuitem" class="w-full rounded px-3 py-2 text-left text-sm text-ink-gray-8 hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" @click="onExport('html')">HTML</button>
              </div>
            </div>

            <div class="ml-auto">
              <Button v-if="!confirmingDelete" variant="ghost" icon="lucide-trash-2" label="Delete" @click="confirmingDelete = true" />
              <div v-else class="flex items-center gap-2">
                <span class="text-sm text-ink-gray-7">Delete this note?</span>
                <Button variant="ghost" label="Cancel" @click="confirmingDelete = false" />
                <Button variant="solid" theme="red" icon="lucide-trash-2" label="Delete" @click="onDelete" />
              </div>
            </div>
          </div>

          <p v-if="notes.saveError.value" class="mt-4 rounded-lg bg-surface-red-1 px-3 py-2 text-sm leading-6 text-ink-red-4" role="alert">{{ notes.saveError.value }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import * as frappeUi from 'frappe-ui'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import TagInput from '@/components/inputs/TagInput.vue'
import { useNotes } from '@/tools/notes/useNotes'

const TOOL_ID = 'notes'

// Use frappe-ui's TipTap-based editor when the installed build exports it; otherwise fall back
// to a plain contenteditable region bound to the sanitized HTML. The lookup is guarded so a
// build (or a test mock) that omits the export falls back instead of throwing. The server
// sanitizes every save, so either path stores safe content.
const TextEditor = resolveTextEditor()
const hasRichEditor = Boolean(TextEditor)

function resolveTextEditor() {
  try {
    return frappeUi.TextEditor || null
  } catch {
    return null
  }
}

const preferences = useToolboxPreferences()
const notes = useNotes()

const fallbackEditor = ref(null)
const showExportMenu = ref(false)
const confirmingDelete = ref(false)

// Convenience views over the active note so the template stays readable.
const active = computed(() => notes.activeNote.value)
const activeName = computed(() => notes.activeNote.value?.name)

const saveStatus = computed(() => {
  if (notes.saveError.value) return ''
  return notes.isSaving.value ? 'Saving…' : 'Saved'
})

// Seed the fallback editor's HTML only when the open note changes, never on every keystroke,
// so the caret does not jump while typing. The rich editor manages its own content.
watch(
  activeName,
  async () => {
    if (hasRichEditor) return
    await nextTick()
    if (fallbackEditor.value) fallbackEditor.value.innerHTML = active.value?.content_html || ''
  },
  { immediate: true },
)

onMounted(() => {
  preferences.recordRecent(TOOL_ID)
  void notes.loadList()
})

function rowClass(row) {
  const selected = row.name === activeName.value
  const base = selected
    ? 'border-outline-gray-3 bg-surface-gray-2'
    : 'border-outline-gray-2 bg-surface-base hover:bg-surface-gray-1'
  return row.is_archived ? `${base} opacity-70` : base
}

async function onCreate() {
  confirmingDelete.value = false
  await notes.createNote()
}

function onExport(format) {
  showExportMenu.value = false
  if (format === 'markdown') notes.exportMarkdown()
  else notes.exportHtml()
}

async function onDelete() {
  await notes.deleteActive()
  confirmingDelete.value = false
}
</script>
