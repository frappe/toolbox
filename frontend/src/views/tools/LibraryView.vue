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
          <TextInput
            type="url"
            inputmode="url"
            size="md"
            class="min-w-0 flex-1"
            placeholder="Paste a link (https://…)"
            aria-label="Link URL"
            spellcheck="false"
            :model-value="library.form.value.url"
            @update:model-value="library.form.value.url = $event"
          />
          <div class="flex gap-2">
            <Tooltip text="Fetch the page title and description">
              <Button variant="outline" icon="lucide-sparkles" label="Fetch" :loading="library.isFetchingMeta.value" @click="library.fetchMetadata()" />
            </Tooltip>
            <Button variant="subtle" :label="showDetails ? 'Fewer details' : 'More details'" @click="showDetails = !showDetails" />
            <Button variant="solid" :label="library.editingName.value ? 'Update' : 'Save link'" :loading="library.isSaving.value" type="submit" />
          </div>
        </div>

        <div v-if="showDetails || library.editingName.value" class="grid gap-3 sm:grid-cols-2">
          <TextInput
            size="md"
            placeholder="Title (optional)"
            aria-label="Title"
            :model-value="library.form.value.title"
            @update:model-value="library.form.value.title = $event"
          />
          <FormControl
            type="select"
            size="md"
            aria-label="Status"
            :options="statuses"
            :model-value="library.form.value.status"
            @update:model-value="library.form.value.status = $event"
          />
          <TextInput
            size="md"
            placeholder="Description (optional)"
            aria-label="Description"
            :model-value="library.form.value.description"
            @update:model-value="library.form.value.description = $event"
          />
          <TextInput
            size="md"
            list="library-collections"
            placeholder="Collection (optional)"
            aria-label="Collection"
            :model-value="library.form.value.collection"
            @update:model-value="library.form.value.collection = $event"
          />
          <datalist id="library-collections">
            <option v-for="c in library.collections.value" :key="c.name" :value="c.collection_name" />
          </datalist>
          <FormControl
            type="textarea"
            size="md"
            class="sm:col-span-2"
            :rows="2"
            placeholder="Personal note (optional)"
            aria-label="Personal note"
            :model-value="library.form.value.personal_note"
            @update:model-value="library.form.value.personal_note = $event"
          />
          <div class="sm:col-span-2">
            <TagInput variant="subtle" :model-value="library.form.value.tags" label="Tags" @update:model-value="library.form.value.tags = $event" />
          </div>
          <div v-if="library.editingName.value" class="sm:col-span-2">
            <Button variant="ghost" label="Cancel edit" @click="library.closeForm" />
          </div>
        </div>

        <ErrorMessage :message="library.formError.value" />

        <Alert v-if="library.metaNotice.value" :dismissible="false" :title="library.metaNotice.value" />

        <Alert v-if="library.duplicateHint.value" theme="yellow" :dismissible="false" title="You already saved this link.">
          <template #footer>
            <div class="col-span-full flex flex-wrap gap-2 pt-1">
              <Button variant="subtle" label="Open existing" @click="library.openExistingDuplicate" />
              <Button variant="ghost" label="Save anyway" @click="onSave({ allowDuplicate: true })" />
            </div>
          </template>
        </Alert>
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
      <div class="mt-8 overflow-x-auto">
        <TabButtons
          :options="statusTabOptions"
          :model-value="library.activeStatus.value"
          size="md"
          aria-label="Filter by status"
          @update:model-value="library.activeStatus.value = $event"
        />
      </div>

      <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <TextInput
          type="search"
          size="md"
          class="min-w-0 flex-1"
          placeholder="Search links"
          aria-label="Search links"
          :model-value="library.searchQuery.value"
          @update:model-value="library.searchQuery.value = $event"
        >
          <template #prefix>
            <Icon name="lucide-search" class="size-4 text-ink-gray-5" />
          </template>
        </TextInput>
        <FormControl
          type="select"
          size="md"
          aria-label="Sort links"
          :options="sortOptions"
          :model-value="library.sortBy.value"
          @update:model-value="library.sortBy.value = $event"
        />
        <div class="flex gap-2">
          <label class="sr-only" for="library-import">Import bookmarks</label>
          <input id="library-import" ref="importInput" type="file" accept=".json,.html,.htm" class="hidden" @change="onImportFile" />
          <Button variant="outline" icon="lucide-upload" label="Import" @click="importInput?.click()" />
          <Dropdown :options="exportOptions">
            <Button variant="outline" icon="lucide-download" label="Export" />
          </Dropdown>
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
      <ErrorMessage class="mt-3" :message="library.importError.value" />
      <Alert v-if="library.importResult.value" class="mt-3" theme="green" :dismissible="false" :title="importResultText" />

      <!-- List -->
      <section v-if="library.filteredLinks.value.length" class="mt-4 flex flex-col gap-2" aria-label="Saved links">
        <article v-for="link in library.filteredLinks.value" :key="link.name" class="flex items-start gap-3 rounded-xl border border-outline-gray-2 bg-surface-base p-3">
          <Button
            variant="ghost"
            class="mt-0.5 shrink-0"
            :aria-label="link.is_favourite ? `Unfavourite ${labelOf(link)}` : `Favourite ${labelOf(link)}`"
            @click="library.toggleFavourite(link.name)"
          >
            <Icon name="lucide-star" class="size-4" :class="link.is_favourite ? 'fill-ink-amber-3 text-ink-amber-4' : 'text-ink-gray-4'" />
          </Button>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <component :is="safeHref(link.url) ? 'a' : 'span'" v-bind="linkAttrs(link)" class="truncate text-sm font-medium text-ink-gray-9 hover:underline">{{ labelOf(link) }}</component>
              <Badge class="shrink-0" theme="gray" variant="subtle" size="sm" :label="link.status" />
            </div>
            <p class="truncate text-xs text-ink-gray-5">{{ link.domain || link.url }}</p>
            <div v-if="link.tags?.length || link.collection" class="mt-1 flex flex-wrap items-center gap-1">
              <Badge v-if="link.collection" theme="gray" variant="subtle" size="sm" :label="link.collection" />
              <Badge v-for="tag in link.tags" :key="tag" theme="gray" variant="subtle" size="sm" :label="`#${tag}`" />
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-0.5">
            <FormControl
              type="select"
              size="sm"
              :aria-label="`Status for ${labelOf(link)}`"
              :options="statuses"
              :model-value="link.status"
              @update:model-value="library.changeStatus(link.name, $event)"
            />
            <Button variant="ghost" icon="lucide-pencil" :aria-label="`Edit ${labelOf(link)}`" @click="onEdit(link)" />
            <Button variant="ghost" theme="red" icon="lucide-trash-2" :aria-label="`Delete ${labelOf(link)}`" @click="library.removeLink(link.name)" />
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
import { computed, onMounted, ref } from 'vue'
import { Alert, Badge, Button, Dropdown, ErrorMessage, FormControl, Icon, TabButtons, TextInput, Tooltip } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import TagInput from '@/components/inputs/TagInput.vue'
import { SORT_OPTIONS, STATUS_TABS, STATUSES, safeHref, useLibrary } from '@/tools/library/useLibrary'

const TOOL_ID = 'library'

const preferences = useToolboxPreferences()
const library = useLibrary()

const statuses = STATUSES
const sortOptions = SORT_OPTIONS

// Tab labels carry their live count as a suffix (TabButtons has no per-tab count slot).
const statusTabOptions = computed(() =>
  STATUS_TABS.map((tab) => ({ label: `${tab} ${library.statusCounts.value[tab] ?? 0}`, value: tab })),
)

const exportOptions = [
  { label: 'JSON', onClick: () => onExport('json') },
  { label: 'CSV', onClick: () => onExport('csv') },
]

const importResultText = computed(() => {
  const result = library.importResult.value
  if (!result) return ''
  const failed = result.failed ? ` · failed ${result.failed}` : ''
  return `Imported ${result.imported} · skipped ${result.skipped}${failed}.`
})

const showDetails = ref(false)
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

function onExport(format) {
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
