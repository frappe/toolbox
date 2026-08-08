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
        <Button variant="solid" icon-left="lucide-plus" label="New checklist" @click="onCreate" />
        <Dropdown :options="templateOptions" @update:open="onTemplateMenuToggle">
          <Button variant="ghost" icon-left="lucide-copy-plus" label="Start from a template" />
        </Dropdown>
      </div>
    </section>

    <div v-else class="mt-8 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <!-- List pane -->
      <aside class="min-w-0 flex-col gap-4" :class="checklist.activeChecklist.value ? 'hidden lg:flex' : 'flex'" aria-label="Your checklists">
        <div class="flex flex-col gap-2">
          <Button variant="solid" icon-left="lucide-plus" label="New checklist" @click="onCreate" />
          <Dropdown class="w-full" :options="templateOptions" @update:open="onTemplateMenuToggle">
            <Button class="w-full" variant="outline" icon-left="lucide-copy-plus" label="New from template" />
          </Dropdown>
        </div>

        <TextInput
          type="search"
          size="md"
          placeholder="Search checklists"
          aria-label="Search checklists"
          spellcheck="false"
          :model-value="checklist.searchQuery.value"
          @update:model-value="checklist.searchQuery.value = $event"
        >
          <template #prefix>
            <Icon name="lucide-search" class="size-4 text-ink-gray-5" />
          </template>
        </TextInput>

        <Checkbox
          label="Show archived"
          :model-value="checklist.showArchived.value"
          @update:model-value="checklist.showArchived.value = $event"
        />

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

          <TextInput
            id="checklist-title"
            size="lg"
            variant="subtle"
            class="mt-2"
            placeholder="Untitled checklist"
            aria-label="Checklist title"
            :model-value="active.title"
            @update:model-value="checklist.setTitle"
          />

          <FormControl
            id="checklist-description"
            type="textarea"
            size="md"
            class="mt-2"
            :rows="2"
            placeholder="Add a description (optional)"
            aria-label="Description"
            :model-value="active.description"
            @update:model-value="checklist.setDescription"
          />

          <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <FormControl
              id="checklist-due"
              type="date"
              size="md"
              label="Due date"
              :model-value="active.due_date || ''"
              @update:model-value="checklist.setDueDate"
            />
            <div class="min-w-0 flex-1">
              <TagInput variant="subtle" :model-value="active.tags" label="Tags" placeholder="Add a tag…" @update:model-value="checklist.setTags($event)" />
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
              <Checkbox
                class="shrink-0"
                :aria-label="`Mark ${item.item_text || 'item'} complete`"
                :model-value="item.is_completed"
                @update:model-value="() => checklist.toggleItem(index)"
              />
              <TextInput
                variant="subtle"
                size="sm"
                class="min-w-0 flex-1"
                :class="item.is_completed ? '[&_input]:text-ink-gray-5 [&_input]:line-through' : ''"
                :aria-label="`Item ${index + 1}`"
                :model-value="item.item_text"
                @update:model-value="(value) => checklist.updateItemText(index, value)"
              />
              <div class="flex shrink-0 items-center">
                <Button variant="ghost" icon="lucide-chevron-up" aria-label="Move up" :disabled="index === 0" @click="checklist.moveItem(index, -1)" />
                <Button variant="ghost" icon="lucide-chevron-down" aria-label="Move down" :disabled="index === displayItems.length - 1" @click="checklist.moveItem(index, 1)" />
                <Button variant="ghost" theme="red" icon="lucide-trash-2" :aria-label="`Remove ${item.item_text || 'item'}`" @click="checklist.removeItem(index)" />
              </div>
            </li>
          </ul>

          <!-- Add item -->
          <form class="mt-2 flex gap-2" @submit.prevent="onAddItem">
            <TextInput
              id="checklist-new-item"
              ref="newItemInput"
              size="md"
              class="min-w-0 flex-1"
              placeholder="Add an item and press Enter"
              aria-label="Add an item"
              :model-value="newItemText"
              @update:model-value="newItemText = $event"
            />
            <Button variant="subtle" icon-left="lucide-plus" label="Add" type="submit" />
          </form>

          <!-- Settings -->
          <div class="mt-5 border-t border-outline-gray-2 pt-4">
            <Checkbox
              label="Move completed items to the bottom"
              :model-value="active.move_completed_to_bottom"
              @update:model-value="checklist.setMoveCompletedToBottom"
            />
          </div>

          <!-- Actions -->
          <div class="mt-5 flex flex-wrap items-center gap-2 border-t border-outline-gray-2 pt-4">
            <Button variant="outline" :icon-left="active.is_pinned ? 'lucide-pin-off' : 'lucide-pin'" :label="active.is_pinned ? 'Unpin' : 'Pin'" @click="checklist.togglePin" />
            <Button variant="outline" :icon-left="active.is_archived ? 'lucide-archive-restore' : 'lucide-archive'" :label="active.is_archived ? 'Unarchive' : 'Archive'" @click="checklist.toggleArchive" />
            <Button variant="outline" icon-left="lucide-copy" label="Duplicate" @click="checklist.duplicateActive" />
            <Button variant="outline" :icon-left="savedAsTemplate ? 'lucide-check' : 'lucide-bookmark'" :label="savedAsTemplate ? 'Saved as template' : 'Save as template'" @click="onSaveAsTemplate" />

            <Dropdown :options="exportOptions">
              <Button variant="outline" icon-left="lucide-download" label="Export" />
            </Dropdown>

            <Button variant="ghost" icon-left="lucide-eraser" label="Clear completed" @click="checklist.clearCompleted" />
            <Button variant="ghost" icon-left="lucide-rotate-ccw" label="Reset all" @click="checklist.resetAll" />

            <div class="ml-auto">
              <Button v-if="!confirmingDelete" variant="ghost" icon-left="lucide-trash-2" label="Delete" @click="confirmingDelete = true" />
              <div v-else class="flex items-center gap-2">
                <span class="text-sm text-ink-gray-7">Delete this checklist?</span>
                <Button variant="ghost" label="Cancel" @click="confirmingDelete = false" />
                <Button variant="solid" theme="red" icon-left="lucide-trash-2" label="Delete" @click="onDelete" />
              </div>
            </div>
          </div>

          <ErrorMessage class="mt-4" :message="checklist.saveError.value" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { Button, Checkbox, Dropdown, ErrorMessage, FormControl, Icon, TextInput } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import TagInput from '@/components/inputs/TagInput.vue'
import { useChecklists } from '@/tools/checklists/useChecklists'

const TOOL_ID = 'checklists'

const preferences = useToolboxPreferences()
const checklist = useChecklists()

const newItemText = ref('')
const newItemInput = ref(null)
const confirmingDelete = ref(false)
const savedAsTemplate = ref(false)

const exportOptions = [
  { label: 'Markdown', onClick: () => onExport('markdown') },
  { label: 'JSON', onClick: () => onExport('json') },
]

// The template picker (both call sites) reads the shared, lazily-loaded template list.
const templateOptions = computed(() =>
  checklist.templates.value.map((tpl) => ({
    label: tpl.template_name,
    onClick: () => onPickTemplate(tpl),
  })),
)

// Load templates the first time either template menu opens, matching the old lazy fetch.
function onTemplateMenuToggle(isOpen) {
  if (isOpen && !checklist.templates.value.length) void checklist.loadTemplates()
}

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
  await checklist.createChecklist()
}

async function onPickTemplate(template) {
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
  // Keep focus on the field so a run of items can be typed quickly (TextInput exposes `el`).
  void nextTick(() => newItemInput.value?.el?.focus())
}

function onExport(format) {
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
