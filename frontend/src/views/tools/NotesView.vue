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
      <Button class="mt-5" variant="solid" icon-left="lucide-plus" label="New note" @click="onCreate" />
    </section>

    <div v-else class="mt-8 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <!-- List pane -->
      <aside class="min-w-0 flex-col gap-4" :class="notes.activeNote.value ? 'hidden lg:flex' : 'flex'" aria-label="Your notes">
        <Button variant="solid" icon-left="lucide-plus" label="New note" @click="onCreate" />

        <TextInput
          type="search"
          size="md"
          placeholder="Search notes"
          aria-label="Search notes"
          spellcheck="false"
          :model-value="notes.searchQuery.value"
          @update:model-value="notes.searchQuery.value = $event"
        >
          <template #prefix>
            <Icon name="lucide-search" class="size-4 text-ink-gray-5" />
          </template>
        </TextInput>

        <Checkbox
          label="Show archived"
          :model-value="notes.showArchived.value"
          @update:model-value="notes.showArchived.value = $event"
        />

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

          <TextInput
            id="note-title"
            size="lg"
            variant="subtle"
            class="mt-2"
            placeholder="Untitled note"
            aria-label="Note title"
            :model-value="active.title"
            @update:model-value="notes.setTitle"
          />

          <!--
            The shared frappe-ui editor, the same one Gameplan and Writer build on.
            `<Editor>` owns the engine and hands the layout to this slot, so the box,
            the menus and the scroll area are ours. Keyed by note so switching notes
            rebuilds the document instead of diffing one note's HTML into another.
          -->
          <div class="mt-3">
            <Editor
              :key="active.name"
              :model-value="active.content_html"
              :extensions="editorExtensions"
              format="html"
              placeholder="Start writing…"
              @change="notes.setContentHtml($event)"
            >
              <template #default>
                <div class="overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-base focus-within:border-outline-gray-3 focus-within:ring-2 focus-within:ring-outline-gray-3">
                  <EditorBubbleMenu :items="bubbleMenuItems" />
                  <div class="border-b border-outline-gray-1 px-2 py-1.5">
                    <EditorFixedMenu :items="fixedMenuItems" class="flex-wrap" />
                  </div>
                  <EditorContent class="min-h-48 px-3 py-2 text-ink-gray-8" />
                </div>
              </template>
            </Editor>
          </div>

          <div class="mt-3">
            <TagInput variant="subtle" :model-value="active.tags" label="Tags" placeholder="Add a tag…" @update:model-value="notes.setTags($event)" />
          </div>

          <!-- Actions -->
          <div class="mt-5 flex flex-wrap items-center gap-2 border-t border-outline-gray-2 pt-4">
            <Button variant="outline" :icon-left="active.is_pinned ? 'lucide-pin-off' : 'lucide-pin'" :label="active.is_pinned ? 'Unpin' : 'Pin'" @click="notes.togglePin" />
            <Button variant="outline" :icon-left="active.is_archived ? 'lucide-archive-restore' : 'lucide-archive'" :label="active.is_archived ? 'Unarchive' : 'Archive'" @click="notes.toggleArchive" />
            <Button variant="outline" icon-left="lucide-copy" label="Duplicate" @click="notes.duplicateActive" />

            <Dropdown :options="exportOptions">
              <Button variant="outline" icon-left="lucide-download" label="Export" />
            </Dropdown>

            <div class="ml-auto">
              <Button v-if="!confirmingDelete" variant="ghost" icon-left="lucide-trash-2" label="Delete" @click="confirmingDelete = true" />
              <div v-else class="flex items-center gap-2">
                <span class="text-sm text-ink-gray-7">Delete this note?</span>
                <Button variant="ghost" label="Cancel" @click="confirmingDelete = false" />
                <Button variant="solid" theme="red" icon-left="lucide-trash-2" label="Delete" @click="onDelete" />
              </div>
            </div>
          </div>

          <ErrorMessage class="mt-4" :message="notes.saveError.value" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Button, Checkbox, Dropdown, ErrorMessage, Icon, TextInput } from 'frappe-ui'
import {
  Blockquote,
  Bold,
  BulletList,
  Editor,
  EditorBubbleMenu,
  EditorContent,
  EditorFixedMenu,
  HeadingGroup,
  InlineCode,
  InsertLink,
  Italic,
  OrderedList,
  RichTextKit,
  Separator,
  Strike,
} from 'frappe-ui/editor'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import TagInput from '@/components/inputs/TagInput.vue'
import { useNotes } from '@/tools/notes/useNotes'

const TOOL_ID = 'notes'

// A note is prose, so the toolbar stays to text structure. No tables, images or
// embeds: those need an upload endpoint and a wider column than the notes pane.
const editorExtensions = [RichTextKit]
const fixedMenuItems = [HeadingGroup, Separator, Bold, Italic, Strike, InlineCode, Separator, BulletList, OrderedList, Blockquote, Separator, InsertLink]
const bubbleMenuItems = [Bold, Italic, Strike, InsertLink]

const preferences = useToolboxPreferences()
const notes = useNotes()

const confirmingDelete = ref(false)

const exportOptions = [
  { label: 'Markdown', onClick: () => onExport('markdown') },
  { label: 'HTML', onClick: () => onExport('html') },
]

// Convenience views over the active note so the template stays readable.
const active = computed(() => notes.activeNote.value)
const activeName = computed(() => notes.activeNote.value?.name)

const saveStatus = computed(() => {
  if (notes.saveError.value) return ''
  return notes.isSaving.value ? 'Saving…' : 'Saved'
})

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
  if (format === 'markdown') notes.exportMarkdown()
  else notes.exportHtml()
}

async function onDelete() {
  await notes.deleteActive()
  confirmingDelete.value = false
}
</script>
