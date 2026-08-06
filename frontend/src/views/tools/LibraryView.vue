<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-bookmark" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Save</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">Library</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Save links to read later, with collections, tags, and search.</p>
      </div>
    </header>

    <!-- Save form -->
    <section class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-5" aria-label="Save a link">
      <form class="flex flex-col gap-3" @submit.prevent="onSave()">
        <div class="flex flex-col gap-2 sm:flex-row">
          <input v-model="library.form.value.url" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="Paste a link (https://…)" aria-label="Link URL" class="h-10 min-w-0 flex-1 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
          <div class="flex gap-2">
            <Button variant="outline" icon="lucide-sparkles" label="Fetch" title="Fetch the page title and description" :loading="library.isFetchingMeta.value" @click="library.fetchMetadata()" />
            <Button variant="subtle" :label="showDetails ? 'Fewer details' : 'More details'" @click="showDetails = !showDetails" />
            <Button variant="solid" :label="library.editingName.value ? 'Update' : 'Save link'" :loading="library.isSaving.value" type="submit" />
          </div>
        </div>

        <div v-if="showDetails || library.editingName.value" class="grid gap-3 sm:grid-cols-2">
          <input v-model="library.form.value.title" type="text" placeholder="Title (optional)" aria-label="Title" class="h-10 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3" />
          <select v-model="library.form.value.status" aria-label="Status" class="h-10 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3">
            <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
          </select>
          <input v-model="library.form.value.description" type="text" placeholder="Description (optional)" aria-label="Description" class="h-10 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3" />
          <input v-model="library.form.value.collection" list="library-collections" type="text" placeholder="Collection (optional)" aria-label="Collection" class="h-10 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3" />
          <datalist id="library-collections">
            <option v-for="c in library.collections.value" :key="c.name" :value="c.collection_name" />
          </datalist>
          <textarea v-model="library.form.value.personal_note" rows="2" placeholder="Personal note (optional)" aria-label="Personal note" class="resize-y rounded-lg border border-outline-gray-2 bg-surface-base px-3 py-2 text-sm text-ink-gray-9 outline-none focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 sm:col-span-2" />
          <div class="sm:col-span-2">
            <TagInput :model-value="library.form.value.tags" label="Tags" @update:model-value="library.form.value.tags = $event" />
          </div>
          <div v-if="library.editingName.value" class="sm:col-span-2">
            <Button variant="ghost" label="Cancel edit" @click="library.closeForm" />
          </div>
        </div>

        <p v-if="library.formError.value" class="rounded-lg bg-surface-red-1 px-3 py-2 text-sm text-ink-red-4" role="alert">{{ library.formError.value }}</p>

        <p v-if="library.metaNotice.value" class="rounded-lg bg-surface-gray-2 px-3 py-2 text-sm text-ink-gray-7" role="status" aria-live="polite">{{ library.metaNotice.value }}</p>

        <div v-if="library.duplicateHint.value" class="flex flex-wrap items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-amber-1 px-3 py-2 text-sm text-ink-gray-8" role="status">
          <Icon name="lucide-copy" class="size-4 shrink-0 text-ink-gray-6" />
          <span class="min-w-0 flex-1">You already saved this link.</span>
          <Button variant="subtle" label="Open existing" @click="library.openExistingDuplicate" />
          <Button variant="ghost" label="Save anyway" @click="onSave({ allowDuplicate: true })" />
        </div>
      </form>
    </section>

    <!-- Error / loading -->
    <div v-if="library.state.value === 'error'" class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-8 text-center" role="alert">
      <Icon name="lucide-wifi-off" class="mx-auto size-7 text-ink-gray-5" />
      <h2 class="pt-3 text-base font-semibold text-ink-gray-9">Your library could not be loaded</h2>
      <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">{{ library.errorMessage.value }}</p>
      <Button class="mt-4" label="Try again" @click="library.loadList" />
    </div>

    <div v-else-if="library.state.value === 'loading'" class="mt-8 space-y-3" aria-hidden="true">
      <div v-for="row in 4" :key="row" class="h-16 animate-pulse rounded-xl bg-surface-gray-2 motion-reduce:animate-none" />
    </div>

    <template v-else>
      <!-- Filters -->
      <div class="mt-8 flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter by status">
        <button v-for="tab in statusTabs" :key="tab" type="button" role="tab" :aria-selected="library.activeStatus.value === tab" class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition motion-reduce:transition-none" :class="tabClass(tab)" @click="library.activeStatus.value = tab">
          {{ tab }}
          <span class="tabular-nums text-xs text-ink-gray-5">{{ library.statusCounts.value[tab] ?? 0 }}</span>
        </button>
      </div>

      <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div class="relative min-w-0 flex-1">
          <Icon name="lucide-search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-gray-5" />
          <input v-model="library.searchQuery.value" type="search" autocomplete="off" placeholder="Search links" aria-label="Search links" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base pl-9 pr-3 text-sm text-ink-gray-9 outline-none focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3" />
        </div>
        <select v-model="library.sortBy.value" aria-label="Sort links" class="h-10 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3">
          <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <div class="flex gap-2">
          <label class="sr-only" for="library-import">Import bookmarks</label>
          <input id="library-import" ref="importInput" type="file" accept=".json,.html,.htm" class="hidden" @change="onImportFile" />
          <Button variant="outline" icon="lucide-upload" label="Import" @click="importInput?.click()" />
          <div class="relative">
            <Button variant="outline" icon="lucide-download" label="Export" aria-haspopup="menu" :aria-expanded="showExportMenu" @click="showExportMenu = !showExportMenu" />
            <div v-if="showExportMenu" class="absolute right-0 z-10 mt-1 w-32 rounded-lg border border-outline-gray-2 bg-surface-base p-1 shadow-lg" role="menu">
              <button type="button" role="menuitem" class="w-full rounded px-3 py-2 text-left text-sm text-ink-gray-8 hover:bg-surface-gray-2" @click="onExport('json')">JSON</button>
              <button type="button" role="menuitem" class="w-full rounded px-3 py-2 text-left text-sm text-ink-gray-8 hover:bg-surface-gray-2" @click="onExport('csv')">CSV</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Import preview -->
      <div v-if="library.importPreview.value" class="mt-4 rounded-xl border border-outline-gray-2 bg-surface-gray-1 p-4" role="status">
        <p class="text-sm text-ink-gray-8">Found <strong>{{ library.importPreview.value.total }}</strong> links — <strong>{{ library.importPreview.value.newCount }}</strong> new, {{ library.importPreview.value.duplicates }} already saved.</p>
        <div class="mt-3 flex gap-2">
          <Button variant="solid" :label="`Import ${library.importPreview.value.newCount} new`" :loading="library.isImporting.value" @click="library.commitImport" />
          <Button variant="ghost" label="Cancel" @click="library.cancelImport" />
        </div>
      </div>
      <p v-if="library.importError.value" class="mt-3 rounded-lg bg-surface-red-1 px-3 py-2 text-sm text-ink-red-4" role="alert">{{ library.importError.value }}</p>
      <p v-if="library.importResult.value" class="mt-3 rounded-lg bg-surface-green-1 px-3 py-2 text-sm text-ink-green-7" role="status">Imported {{ library.importResult.value.imported }} · skipped {{ library.importResult.value.skipped }}<span v-if="library.importResult.value.failed"> · failed {{ library.importResult.value.failed }}</span>.</p>

      <!-- List -->
      <section v-if="library.filteredLinks.value.length" class="mt-4 flex flex-col gap-2" aria-label="Saved links">
        <article v-for="link in library.filteredLinks.value" :key="link.name" class="flex items-start gap-3 rounded-xl border border-outline-gray-2 bg-surface-base p-3">
          <button type="button" class="mt-0.5 shrink-0 rounded p-1 transition hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" :aria-label="link.is_favourite ? `Unfavourite ${labelOf(link)}` : `Favourite ${labelOf(link)}`" @click="library.toggleFavourite(link.name)">
            <Icon :name="link.is_favourite ? 'lucide-star' : 'lucide-star'" class="size-4" :class="link.is_favourite ? 'fill-ink-amber-3 text-ink-amber-4' : 'text-ink-gray-4'" />
          </button>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <component :is="safeHref(link.url) ? 'a' : 'span'" v-bind="linkAttrs(link)" class="truncate text-sm font-medium text-ink-gray-9 hover:underline">{{ labelOf(link) }}</component>
              <span class="shrink-0 rounded-full bg-surface-gray-2 px-2 py-0.5 text-xs text-ink-gray-6">{{ link.status }}</span>
            </div>
            <p class="truncate text-xs text-ink-gray-5">{{ link.domain || link.url }}</p>
            <div v-if="link.tags?.length || link.collection" class="mt-1 flex flex-wrap items-center gap-1">
              <span v-if="link.collection" class="rounded bg-surface-gray-2 px-1.5 py-0.5 text-xs text-ink-gray-6">{{ link.collection }}</span>
              <span v-for="tag in link.tags" :key="tag" class="rounded bg-surface-gray-2 px-1.5 py-0.5 text-xs text-ink-gray-6">#{{ tag }}</span>
            </div>
          </div>
          <div class="flex shrink-0 items-center">
            <select :value="link.status" :aria-label="`Status for ${labelOf(link)}`" class="h-8 rounded-lg border border-outline-gray-2 bg-surface-base px-2 text-xs text-ink-gray-8 outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" @change="library.changeStatus(link.name, $event.target.value)">
              <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
            </select>
            <button type="button" class="flex size-8 items-center justify-center rounded text-ink-gray-6 transition hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" :aria-label="`Edit ${labelOf(link)}`" @click="onEdit(link)">
              <Icon name="lucide-pencil" class="size-4" />
            </button>
            <button type="button" class="flex size-8 items-center justify-center rounded text-ink-red-4 transition hover:bg-surface-red-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" :aria-label="`Delete ${labelOf(link)}`" @click="library.removeLink(link.name)">
              <Icon name="lucide-trash-2" class="size-4" />
            </button>
          </div>
        </article>
      </section>

      <section v-else class="mt-4 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-10 text-center">
        <Icon name="lucide-bookmark" class="mx-auto size-8 text-ink-gray-5" />
        <h2 class="pt-3 text-lg font-semibold text-ink-gray-9">{{ library.links.value.length ? 'No links match these filters' : 'No links yet' }}</h2>
        <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">{{ library.links.value.length ? 'Try another status, search, or clear the filters.' : 'Paste a URL above to save your first link.' }}</p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import TagInput from '@/components/inputs/TagInput.vue'
import { SORT_OPTIONS, STATUS_TABS, STATUSES, safeHref, useLibrary } from '@/tools/library/useLibrary'

const TOOL_ID = 'library'

const preferences = useToolboxPreferences()
const library = useLibrary()

const statusTabs = STATUS_TABS
const statuses = STATUSES
const sortOptions = SORT_OPTIONS

const showDetails = ref(false)
const showExportMenu = ref(false)
const importInput = ref(null)

onMounted(() => {
  preferences.recordRecent(TOOL_ID)
  void library.loadList()
})

function labelOf(link) {
  return link.title || link.domain || link.url || 'Untitled link'
}

function linkAttrs(link) {
  const href = safeHref(link.url)
  return href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {}
}

async function onSave(options = {}) {
  const saved = await library.saveForm(options)
  if (saved) showDetails.value = false
}

function onEdit(link) {
  library.startEdit(link)
  showDetails.value = true
}

function tabClass(tab) {
  return library.activeStatus.value === tab
    ? 'border-outline-gray-3 bg-surface-gray-2 text-ink-gray-9'
    : 'border-outline-gray-2 bg-surface-base text-ink-gray-7 hover:bg-surface-gray-1'
}

function onExport(format) {
  showExportMenu.value = false
  if (format === 'json') void library.exportJson()
  else void library.exportCsv()
}

async function onImportFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const text = await file.text()
  library.previewImport(text, file.name)
  event.target.value = ''
}
</script>
