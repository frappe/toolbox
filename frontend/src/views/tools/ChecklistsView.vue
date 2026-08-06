<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-list-checks" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Organize</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">Checklists</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Build reusable checklists and track them item by item.</p>
      </div>
    </header>

    <div v-if="checklist.state.value === 'error'" class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-8 text-center" role="alert">
      <Icon name="lucide-wifi-off" class="mx-auto size-7 text-ink-gray-5" />
      <h2 class="pt-3 text-base font-semibold text-ink-gray-9">Your checklists could not be loaded</h2>
      <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">{{ checklist.errorMessage.value }}</p>
      <Button class="mt-4" label="Try again" @click="checklist.loadList" />
    </div>

    <div v-else-if="checklist.state.value === 'loading'" class="mt-8 space-y-3" aria-hidden="true">
      <div v-for="row in 4" :key="row" class="h-16 animate-pulse rounded-xl bg-surface-gray-2 motion-reduce:animate-none" />
    </div>

    <section v-else-if="checklist.checklists.value.length === 0 && !checklist.activeChecklist.value" class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-10 text-center">
      <Icon name="lucide-list-plus" class="mx-auto size-8 text-ink-gray-5" />
      <h2 class="pt-3 text-lg font-semibold text-ink-gray-9">No checklists yet</h2>
      <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">Start a packing list, a shopping run, or anything you want to check off. It saves as you go.</p>
      <div class="mt-5 flex flex-col items-center gap-2">
        <Button variant="solid" icon="lucide-plus" label="New checklist" @click="onCreate" />
        <div class="relative">
          <Button variant="ghost" icon="lucide-copy-plus" label="Start from a template" aria-haspopup="menu" :aria-expanded="showTemplateMenu" @click="onOpenTemplates" />
          <div v-if="showTemplateMenu" class="absolute left-1/2 z-10 mt-1 max-h-72 w-64 -translate-x-1/2 overflow-auto rounded-lg border border-outline-gray-2 bg-surface-base p-1 text-left shadow-lg" role="menu">
            <button v-for="tpl in checklist.templates.value" :key="tpl.name" type="button" role="menuitem" class="flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm text-ink-gray-8 hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" @click="onPickTemplate(tpl)">
              <span class="min-w-0 truncate">{{ tpl.template_name }}</span>
              <span class="shrink-0 text-xs text-ink-gray-5">{{ tpl.is_system ? 'System' : 'Personal' }}</span>
            </button>
            <p v-if="!checklist.templates.value.length" class="px-3 py-2 text-sm text-ink-gray-5">No templates available.</p>
          </div>
        </div>
      </div>
    </section>

    <div v-else class="mt-8 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <!-- List pane -->
      <aside class="min-w-0 flex-col gap-4" :class="checklist.activeChecklist.value ? 'hidden lg:flex' : 'flex'" aria-label="Your checklists">
        <div class="flex flex-col gap-2">
          <Button variant="solid" icon="lucide-plus" label="New checklist" @click="onCreate" />
          <div class="relative">
            <Button class="w-full" variant="outline" icon="lucide-copy-plus" label="New from template" aria-haspopup="menu" :aria-expanded="showTemplateMenu" @click="onOpenTemplates" />
            <div v-if="showTemplateMenu" class="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-outline-gray-2 bg-surface-base p-1 shadow-lg" role="menu">
              <button v-for="tpl in checklist.templates.value" :key="tpl.name" type="button" role="menuitem" class="flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm text-ink-gray-8 hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" @click="onPickTemplate(tpl)">
                <span class="min-w-0 truncate">{{ tpl.template_name }}</span>
                <span class="shrink-0 text-xs text-ink-gray-5">{{ tpl.is_system ? 'System' : 'Personal' }} · {{ tpl.item_count }}</span>
              </button>
              <p v-if="!checklist.templates.value.length" class="px-3 py-2 text-sm text-ink-gray-5">No templates available.</p>
            </div>
          </div>
        </div>

        <div class="relative">
          <Icon name="lucide-search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-gray-5" />
          <input v-model="checklist.searchQuery.value" type="search" autocomplete="off" spellcheck="false" placeholder="Search checklists" aria-label="Search checklists" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base pl-9 pr-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
        </div>

        <label class="flex items-center gap-2 text-sm text-ink-gray-7">
          <input v-model="checklist.showArchived.value" type="checkbox" class="size-4 rounded border-outline-gray-3 text-ink-gray-9 focus-visible:ring-2 focus-visible:ring-outline-gray-3" />
          Show archived
        </label>

        <ul v-if="checklist.filteredChecklists.value.length" class="flex flex-col gap-1.5" aria-label="Checklist list">
          <li v-for="row in checklist.filteredChecklists.value" :key="row.name">
            <button type="button" :data-checklist-name="row.name" :aria-current="row.name === activeName" class="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition motion-reduce:transition-none" :class="rowClass(row)" @click="checklist.openChecklist(row.name)">
              <Icon v-if="row.is_pinned" name="lucide-pin" class="size-4 shrink-0 text-ink-gray-6" aria-hidden="true" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-ink-gray-8">{{ row.title || 'Untitled checklist' }}</span>
                <span v-if="row.is_archived" class="text-xs text-ink-gray-5">Archived</span>
              </span>
              <span class="shrink-0 text-xs font-medium tabular-nums text-ink-gray-5">{{ row.completed_items }}/{{ row.total_items }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="rounded-xl border border-outline-gray-2 bg-surface-gray-1 px-3 py-6 text-center text-sm text-ink-gray-6">No checklists match your search.</p>
      </aside>

      <!-- Detail pane -->
      <section class="min-w-0" :class="checklist.activeChecklist.value ? 'block' : 'hidden lg:block'" aria-label="Checklist detail">
        <div v-if="!checklist.activeChecklist.value" class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-10 text-center">
          <Icon name="lucide-square-check-big" class="mx-auto size-7 text-ink-gray-5" />
          <h2 class="pt-3 text-base font-semibold text-ink-gray-8">Select a checklist</h2>
          <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">Pick a checklist from the list to view and edit its items.</p>
        </div>

        <div v-else class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-6">
          <div class="flex items-center gap-3">
            <Button class="lg:hidden" variant="ghost" icon="lucide-arrow-left" aria-label="Back to list" @click="checklist.closeActive" />
            <span class="flex-1 text-xs text-ink-gray-5" role="status" aria-live="polite">{{ saveStatus }}</span>
          </div>

          <label for="checklist-title" class="sr-only">Checklist title</label>
          <input id="checklist-title" :value="active.title" type="text" placeholder="Untitled checklist" class="mt-2 w-full rounded-lg border border-transparent bg-transparent px-1 text-xl font-semibold text-ink-gray-9 outline-none transition hover:border-outline-gray-2 focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @input="checklist.setTitle($event.target.value)" />

          <label for="checklist-description" class="sr-only">Description</label>
          <textarea id="checklist-description" :value="active.description" rows="2" placeholder="Add a description (optional)" class="mt-2 w-full resize-y rounded-lg border border-outline-gray-2 bg-surface-base px-3 py-2 text-sm text-ink-gray-8 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @input="checklist.setDescription($event.target.value)" />

          <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div class="flex flex-col gap-1.5">
              <label for="checklist-due" class="text-sm font-medium text-ink-gray-7">Due date</label>
              <input id="checklist-due" :value="active.due_date || ''" type="date" class="h-10 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @input="checklist.setDueDate($event.target.value)" />
            </div>
            <div class="min-w-0 flex-1">
              <TagInput :model-value="active.tags" label="Tags" placeholder="Add a tag…" @update:model-value="checklist.setTags($event)" />
            </div>
          </div>

          <!-- Progress -->
          <div class="mt-5">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-ink-gray-7">Progress</span>
              <span class="text-sm font-medium tabular-nums text-ink-gray-6">{{ progress.completed }}/{{ progress.total }}</span>
            </div>
            <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-gray-3" role="progressbar" :aria-valuenow="progress.percent" aria-valuemin="0" aria-valuemax="100" :aria-label="`${progress.percent}% complete`">
              <div class="h-full rounded-full bg-ink-gray-8 transition-all motion-reduce:transition-none" :style="{ width: `${progress.percent}%` }" />
            </div>
            <p class="sr-only" role="status" aria-live="polite">{{ progress.completed }} of {{ progress.total }} complete</p>
          </div>

          <!-- Items -->
          <ul class="mt-4 flex flex-col gap-1.5">
            <li v-for="(item, index) in displayItems" :key="itemKey(item, index)" class="flex items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-base px-2 py-1.5">
              <input type="checkbox" :checked="item.is_completed" :aria-label="`Mark ${item.item_text || 'item'} complete`" class="size-4 shrink-0 rounded border-outline-gray-3 text-ink-gray-9 focus-visible:ring-2 focus-visible:ring-outline-gray-3" @change="checklist.toggleItem(index)" />
              <input :value="item.item_text" type="text" :aria-label="`Item ${index + 1}`" class="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none transition motion-reduce:transition-none" :class="item.is_completed ? 'text-ink-gray-5 line-through decoration-ink-gray-5' : 'text-ink-gray-9'" @input="checklist.updateItemText(index, $event.target.value)" />
              <div class="flex shrink-0 items-center">
                <button type="button" class="flex size-8 items-center justify-center rounded text-ink-gray-6 transition hover:bg-surface-gray-3 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" aria-label="Move up" :disabled="index === 0" @click="checklist.moveItem(index, -1)">
                  <Icon name="lucide-chevron-up" class="size-4" />
                </button>
                <button type="button" class="flex size-8 items-center justify-center rounded text-ink-gray-6 transition hover:bg-surface-gray-3 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" aria-label="Move down" :disabled="index === displayItems.length - 1" @click="checklist.moveItem(index, 1)">
                  <Icon name="lucide-chevron-down" class="size-4" />
                </button>
                <button type="button" class="flex size-8 items-center justify-center rounded text-ink-red-4 transition hover:bg-surface-red-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" :aria-label="`Remove ${item.item_text || 'item'}`" @click="checklist.removeItem(index)">
                  <Icon name="lucide-trash-2" class="size-4" />
                </button>
              </div>
            </li>
          </ul>

          <!-- Add item -->
          <form class="mt-2 flex gap-2" @submit.prevent="onAddItem">
            <label for="checklist-new-item" class="sr-only">Add an item</label>
            <input id="checklist-new-item" ref="newItemInput" v-model="newItemText" type="text" autocomplete="off" placeholder="Add an item and press Enter" class="h-10 min-w-0 flex-1 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
            <Button variant="subtle" icon="lucide-plus" label="Add" type="submit" />
          </form>

          <!-- Settings -->
          <div class="mt-5 border-t border-outline-gray-2 pt-4">
            <label class="flex items-center gap-2 text-sm text-ink-gray-7">
              <input type="checkbox" :checked="active.move_completed_to_bottom" class="size-4 rounded border-outline-gray-3 text-ink-gray-9 focus-visible:ring-2 focus-visible:ring-outline-gray-3" @change="checklist.setMoveCompletedToBottom($event.target.checked)" />
              Move completed items to the bottom
            </label>
          </div>

          <!-- Actions -->
          <div class="mt-5 flex flex-wrap items-center gap-2 border-t border-outline-gray-2 pt-4">
            <Button variant="outline" :icon="active.is_pinned ? 'lucide-pin-off' : 'lucide-pin'" :label="active.is_pinned ? 'Unpin' : 'Pin'" @click="checklist.togglePin" />
            <Button variant="outline" :icon="active.is_archived ? 'lucide-archive-restore' : 'lucide-archive'" :label="active.is_archived ? 'Unarchive' : 'Archive'" @click="checklist.toggleArchive" />
            <Button variant="outline" icon="lucide-copy" label="Duplicate" @click="checklist.duplicateActive" />
            <Button variant="outline" :icon="savedAsTemplate ? 'lucide-check' : 'lucide-bookmark'" :label="savedAsTemplate ? 'Saved as template' : 'Save as template'" @click="onSaveAsTemplate" />

            <div class="relative">
              <Button variant="outline" icon="lucide-download" label="Export" aria-haspopup="menu" :aria-expanded="showExportMenu" @click="showExportMenu = !showExportMenu" />
              <div v-if="showExportMenu" class="absolute z-10 mt-1 w-40 rounded-lg border border-outline-gray-2 bg-surface-base p-1 shadow-lg" role="menu">
                <button type="button" role="menuitem" class="w-full rounded px-3 py-2 text-left text-sm text-ink-gray-8 hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" @click="onExport('markdown')">Markdown</button>
                <button type="button" role="menuitem" class="w-full rounded px-3 py-2 text-left text-sm text-ink-gray-8 hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" @click="onExport('json')">JSON</button>
              </div>
            </div>

            <Button variant="ghost" icon="lucide-eraser" label="Clear completed" @click="checklist.clearCompleted" />
            <Button variant="ghost" icon="lucide-rotate-ccw" label="Reset all" @click="checklist.resetAll" />

            <div class="ml-auto">
              <Button v-if="!confirmingDelete" variant="ghost" icon="lucide-trash-2" label="Delete" @click="confirmingDelete = true" />
              <div v-else class="flex items-center gap-2">
                <span class="text-sm text-ink-gray-7">Delete this checklist?</span>
                <Button variant="ghost" label="Cancel" @click="confirmingDelete = false" />
                <Button variant="solid" theme="red" icon="lucide-trash-2" label="Delete" @click="onDelete" />
              </div>
            </div>
          </div>

          <p v-if="checklist.saveError.value" class="mt-4 rounded-lg bg-surface-red-1 px-3 py-2 text-sm leading-6 text-ink-red-4" role="alert">{{ checklist.saveError.value }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import TagInput from '@/components/inputs/TagInput.vue'
import { useChecklists } from '@/tools/checklists/useChecklists'

const TOOL_ID = 'checklists'

const preferences = useToolboxPreferences()
const checklist = useChecklists()

const newItemText = ref('')
const newItemInput = ref(null)
const showExportMenu = ref(false)
const confirmingDelete = ref(false)
const showTemplateMenu = ref(false)
const savedAsTemplate = ref(false)

// Convenience views over the active checklist so the template stays readable.
const active = computed(() => checklist.activeChecklist.value)
const displayItems = computed(() => checklist.displayItems.value)
const progress = computed(() => checklist.progress.value)
const activeName = computed(() => checklist.activeChecklist.value?.name)

const saveStatus = computed(() => {
  if (checklist.saveError.value) return ''
  return checklist.isSaving.value ? 'Saving…' : 'Saved'
})

onMounted(() => {
  preferences.recordRecent(TOOL_ID)
  void checklist.loadList()
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
  showTemplateMenu.value = false
  await checklist.createChecklist()
}

async function onOpenTemplates() {
  showTemplateMenu.value = !showTemplateMenu.value
  if (showTemplateMenu.value && !checklist.templates.value.length) {
    await checklist.loadTemplates()
  }
}

async function onPickTemplate(template) {
  showTemplateMenu.value = false
  confirmingDelete.value = false
  await checklist.createFromTemplate(template.name)
}

async function onSaveAsTemplate() {
  const saved = await checklist.saveActiveAsTemplate()
  if (!saved) return
  savedAsTemplate.value = true
  setTimeout(() => {
    savedAsTemplate.value = false
  }, 2500)
}

function onAddItem() {
  const value = newItemText.value.trim()
  if (!value) return
  checklist.addItem(value)
  newItemText.value = ''
  // Keep focus on the field so a run of items can be typed quickly.
  void nextTick(() => newItemInput.value?.focus())
}

function onExport(format) {
  showExportMenu.value = false
  if (format === 'markdown') checklist.exportMarkdown()
  else checklist.exportJson()
}

async function onDelete() {
  await checklist.deleteActive()
  confirmingDelete.value = false
}

// Items lack a stable id, so pair the text with its index for the render key.
function itemKey(item, index) {
  return `${index}-${item.item_text}`
}
</script>
