<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-bell" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Organize</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">Reminders</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Schedule one-off and recurring reminders, and get nudged when they are due.</p>
      </div>
    </header>

    <!-- Due-now inbox -->
    <section v-if="reminders.dueCount.value > 0" class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-amber-1 p-4 sm:p-5" aria-label="Reminders due now" aria-live="polite">
      <div class="flex items-center gap-2">
        <Icon name="lucide-bell-ring" class="size-5 text-ink-amber-3" aria-hidden="true" />
        <h2 class="text-sm font-semibold text-ink-gray-8">Due now</h2>
        <span class="rounded-full bg-surface-gray-3 px-2 py-0.5 text-xs font-medium tabular-nums text-ink-gray-7">{{ reminders.dueCount.value }}</span>
      </div>
      <ul class="mt-3 flex flex-col gap-2">
        <li v-for="item in reminders.dueList.value" :key="item.name" :data-due-name="item.name" class="rounded-xl border border-outline-gray-2 bg-surface-base p-3">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-ink-gray-9">{{ item.reminder_title || 'Reminder' }}</p>
              <p class="mt-0.5 text-xs text-ink-gray-6">{{ formatInstant(item.scheduled_for, {}) }}</p>
              <p v-if="item.note" class="mt-1 text-sm leading-6 text-ink-gray-7">{{ item.note }}</p>
            </div>
            <div class="flex shrink-0 flex-wrap items-center gap-1.5">
              <Button variant="subtle" icon="lucide-check" label="Complete" @click="reminders.complete(item.reminder)" />
              <div class="relative">
                <Button variant="ghost" icon="lucide-clock" label="Snooze" aria-haspopup="menu" :aria-expanded="openSnoozeFor === item.name" @click="toggleSnooze(item.name)" />
                <div v-if="openSnoozeFor === item.name" class="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-outline-gray-2 bg-surface-base p-1 shadow-lg" role="menu">
                  <button v-for="option in snoozeOptions" :key="option.preset" type="button" role="menuitem" class="w-full rounded px-3 py-2 text-left text-sm text-ink-gray-8 hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" @click="onSnooze(item.reminder, option.preset)">{{ option.label }}</button>
                </div>
              </div>
              <Button variant="ghost" icon="lucide-x" label="Dismiss" @click="reminders.acknowledgeDue(item.name)" />
            </div>
          </div>
        </li>
      </ul>
    </section>

    <!-- Error state -->
    <div v-if="reminders.state.value === 'error'" class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-8 text-center" role="alert">
      <Icon name="lucide-wifi-off" class="mx-auto size-7 text-ink-gray-5" />
      <h2 class="pt-3 text-base font-semibold text-ink-gray-9">Your reminders could not be loaded</h2>
      <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">{{ reminders.errorMessage.value }}</p>
      <Button class="mt-4" label="Try again" @click="reminders.loadList" />
    </div>

    <!-- Loading skeleton -->
    <div v-else-if="reminders.state.value === 'loading'" class="mt-8 space-y-3" aria-hidden="true">
      <div v-for="row in 4" :key="row" class="h-16 animate-pulse rounded-xl bg-surface-gray-2 motion-reduce:animate-none" />
    </div>

    <!-- Empty state -->
    <section v-else-if="isPrimaryEmpty" class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-10 text-center">
      <Icon name="lucide-bell-plus" class="mx-auto size-8 text-ink-gray-5" />
      <h2 class="pt-3 text-lg font-semibold text-ink-gray-9">No reminders yet</h2>
      <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">Set a reminder for a one-off task or a recurring routine. Toolbox nudges you when it is due.</p>
      <Button class="mt-5" variant="solid" icon="lucide-plus" label="New reminder" @click="onNew" />
    </section>

    <!-- Main -->
    <div v-else class="mt-8">
      <!-- Toolbar -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="inline-flex shrink-0 rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-0.5" role="tablist" aria-label="Reminder scope">
          <button v-for="tab in scopeTabs" :key="tab.value" type="button" role="tab" :aria-selected="reminders.scope.value === tab.value" class="rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" :class="reminders.scope.value === tab.value ? 'bg-surface-base text-ink-gray-9 shadow-sm' : 'text-ink-gray-6 hover:text-ink-gray-8'" @click="onSetScope(tab.value)">{{ tab.label }}</button>
        </div>

        <div class="relative min-w-0 flex-1">
          <Icon name="lucide-search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-gray-5" />
          <input v-model="reminders.searchQuery.value" type="search" autocomplete="off" spellcheck="false" placeholder="Search reminders" aria-label="Search reminders" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base pl-9 pr-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
        </div>

        <div class="flex items-center gap-2">
          <Button variant="solid" icon="lucide-plus" label="New reminder" @click="onNew" />
          <div class="relative">
            <Button variant="outline" icon="lucide-download" label="Export" aria-haspopup="menu" :aria-expanded="showExportMenu" @click="showExportMenu = !showExportMenu" />
            <div v-if="showExportMenu" class="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-outline-gray-2 bg-surface-base p-1 shadow-lg" role="menu">
              <button type="button" role="menuitem" class="w-full rounded px-3 py-2 text-left text-sm text-ink-gray-8 hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" @click="onExport('json')">JSON</button>
              <button type="button" role="menuitem" class="w-full rounded px-3 py-2 text-left text-sm text-ink-gray-8 hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" @click="onExport('csv')">CSV</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit form -->
      <form v-if="form" class="mt-6 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-6" aria-label="Reminder details" @submit.prevent="onSave">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-ink-gray-9">{{ form.name ? 'Edit reminder' : 'New reminder' }}</h2>
          <Button variant="ghost" icon="lucide-x" aria-label="Close form" @click="reminders.closeForm()" />
        </div>

        <div class="mt-4 flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <label for="reminder-title" class="text-sm font-medium text-ink-gray-7">Title</label>
            <input id="reminder-title" v-model="form.title" type="text" required placeholder="What is this reminder about?" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="reminder-note" class="text-sm font-medium text-ink-gray-7">Note</label>
            <textarea id="reminder-note" v-model="form.note" rows="2" placeholder="Add a note (optional)" class="w-full resize-y rounded-lg border border-outline-gray-2 bg-surface-base px-3 py-2 text-sm text-ink-gray-8 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <label for="reminder-date" class="text-sm font-medium text-ink-gray-7">Date</label>
              <input id="reminder-date" v-model="form.local_date" type="date" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="reminder-time" class="text-sm font-medium text-ink-gray-7">Time</label>
              <input id="reminder-time" v-model="form.local_time" type="time" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="reminder-timezone" class="text-sm font-medium text-ink-gray-7">Time zone</label>
            <select id="reminder-timezone" v-model="form.time_zone" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none">
              <option v-for="zone in timeZoneOptions" :key="zone" :value="zone">{{ zone }}</option>
            </select>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="reminder-repeat" class="text-sm font-medium text-ink-gray-7">Repeat</label>
            <select id="reminder-repeat" v-model="form.repeat_type" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none">
              <option v-for="option in repeatTypes" :key="option" :value="option">{{ option }}</option>
            </select>
          </div>

          <div v-if="form.repeat_type !== 'None'" class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <label for="reminder-interval" class="text-sm font-medium text-ink-gray-7">Repeat every</label>
              <div class="flex items-center gap-2">
                <input id="reminder-interval" v-model.number="form.repeat_interval" type="number" min="1" step="1" class="h-10 w-24 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
                <span class="text-sm text-ink-gray-6">{{ repeatUnitLabel }}</span>
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="reminder-end" class="text-sm font-medium text-ink-gray-7">Ends on</label>
              <input id="reminder-end" v-model="form.repeat_end_date" type="date" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
              <p class="text-xs text-ink-gray-5">Optional — leave blank to repeat indefinitely.</p>
            </div>
          </div>

          <fieldset class="flex flex-col gap-2">
            <legend class="text-sm font-medium text-ink-gray-7">Notify me</legend>
            <label class="flex items-center gap-2 text-sm text-ink-gray-7">
              <input v-model="form.delivery_in_app" type="checkbox" class="size-4 rounded border-outline-gray-3 text-ink-gray-9 focus-visible:ring-2 focus-visible:ring-outline-gray-3" />
              In-app
            </label>
            <label class="flex items-center gap-2 text-sm text-ink-gray-7">
              <input v-model="form.delivery_email" type="checkbox" class="size-4 rounded border-outline-gray-3 text-ink-gray-9 focus-visible:ring-2 focus-visible:ring-outline-gray-3" />
              Email
            </label>
            <label class="flex items-center gap-2 text-sm" :class="browserDisabled ? 'text-ink-gray-4' : 'text-ink-gray-7'">
              <input v-model="form.delivery_browser" type="checkbox" :disabled="browserDisabled" class="size-4 rounded border-outline-gray-3 text-ink-gray-9 focus-visible:ring-2 focus-visible:ring-outline-gray-3 disabled:cursor-not-allowed" @change="onToggleBrowser" />
              Browser notification
            </label>
            <p v-if="reminders.browserPermission.value === 'unsupported'" class="text-xs text-ink-gray-5">This browser does not support notifications.</p>
            <p v-else-if="reminders.browserPermission.value === 'denied'" class="text-xs text-ink-gray-5">Your browser has blocked notifications. Allow them in your browser settings to use this.</p>
          </fieldset>

          <TagInput :model-value="form.tags" label="Tags" placeholder="Add a tag…" @update:model-value="form.tags = $event" />
        </div>

        <p class="sr-only" role="status" aria-live="polite">{{ savingStatus }}</p>
        <p v-if="reminders.saveError.value" class="mt-4 rounded-lg bg-surface-red-1 px-3 py-2 text-sm leading-6 text-ink-red-4" role="alert">{{ reminders.saveError.value }}</p>

        <div class="mt-5 flex items-center gap-2 border-t border-outline-gray-2 pt-4">
          <Button variant="solid" type="submit" :loading="reminders.isSaving.value" :label="reminders.isSaving.value ? 'Saving…' : 'Save reminder'" />
          <Button variant="ghost" label="Cancel" @click="reminders.closeForm()" />
        </div>
      </form>

      <!-- List -->
      <div class="mt-6 flex flex-col gap-6">
        <template v-if="reminders.sections.value.length">
          <section v-for="section in reminders.sections.value" :key="section.key" :aria-labelledby="`reminders-section-${section.key}`">
            <h2 :id="`reminders-section-${section.key}`" class="text-xs font-semibold uppercase tracking-wide text-ink-gray-5">{{ section.label }}</h2>
            <ul class="mt-2 flex flex-col gap-1.5">
              <li v-for="row in section.items" :key="row.name" :data-reminder-name="row.name" class="rounded-xl border bg-surface-base p-3" :class="section.key === 'overdue' ? 'border-outline-red-3' : 'border-outline-gray-2'">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <p class="truncate text-sm font-medium text-ink-gray-9">{{ row.title || 'Untitled reminder' }}</p>
                      <span v-if="section.key === 'overdue'" class="shrink-0 rounded-full bg-surface-red-1 px-2 py-0.5 text-xs font-medium text-ink-red-4">Overdue</span>
                    </div>
                    <p v-if="row.next_trigger" class="mt-0.5 text-xs text-ink-gray-6">{{ formatInstant(row.next_trigger, { timeZone: row.time_zone }) }}</p>
                    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-gray-5">
                      <span>{{ describeRepeat(row) }}</span>
                      <span v-if="row.snoozed_until">Snoozed until {{ formatInstant(row.snoozed_until, { timeZone: row.time_zone }) }}</span>
                    </div>
                    <ul v-if="row.tags && row.tags.length" class="mt-2 flex flex-wrap gap-1" aria-label="Tags">
                      <li v-for="tag in row.tags" :key="tag" class="rounded-md bg-surface-gray-2 px-2 py-0.5 text-xs text-ink-gray-7">{{ tag }}</li>
                    </ul>
                  </div>
                  <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Button variant="subtle" icon="lucide-pencil" label="Edit" @click="onEdit(row.name)" />
                    <Button v-if="reminders.scope.value !== 'completed'" variant="ghost" icon="lucide-check" label="Complete" @click="reminders.complete(row.name)" />
                    <template v-if="confirmingDeleteName === row.name">
                      <span class="text-xs text-ink-gray-7">Delete?</span>
                      <Button variant="ghost" label="Cancel" @click="confirmingDeleteName = null" />
                      <Button variant="solid" theme="red" icon="lucide-trash-2" label="Delete" @click="onDelete(row.name)" />
                    </template>
                    <Button v-else variant="ghost" icon="lucide-trash-2" aria-label="Delete reminder" @click="confirmingDeleteName = row.name" />
                  </div>
                </div>
              </li>
            </ul>
          </section>
        </template>
        <p v-else class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 px-4 py-10 text-center text-sm text-ink-gray-6">{{ emptyListMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import TagInput from '@/components/inputs/TagInput.vue'
import { describeRepeat, formatInstant, useReminders } from '@/tools/reminders/useReminders'

const TOOL_ID = 'reminders'

const preferences = useToolboxPreferences()
const reminders = useReminders()

const showExportMenu = ref(false)
const confirmingDeleteName = ref(null)
const openSnoozeFor = ref(null)

const scopeTabs = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

const repeatTypes = ['None', 'Daily', 'Weekly', 'Monthly', 'Yearly']

const snoozeOptions = [
  { preset: '10m', label: '10 minutes' },
  { preset: '30m', label: '30 minutes' },
  { preset: '1h', label: '1 hour' },
  { preset: 'tomorrow', label: 'Tomorrow' },
]

// A convenience view over the open form so the template stays readable. Fields v-model directly
// onto this reactive object; the form is explicit-save, so nothing persists until Save.
const form = computed(() => reminders.activeReminder.value)

// The full "No reminders yet" card is only for a genuinely empty active list with no search or
// open form. In every other case the toolbar stays visible so the scope can still be switched.
const isPrimaryEmpty = computed(
  () =>
    reminders.state.value === 'ready' &&
    reminders.scope.value === 'active' &&
    !reminders.searchQuery.value.trim() &&
    reminders.reminders.value.length === 0 &&
    !reminders.activeReminder.value,
)

const emptyListMessage = computed(() => {
  if (reminders.searchQuery.value.trim()) return 'No reminders match your search.'
  if (reminders.scope.value === 'completed') return 'No completed reminders yet.'
  return 'No reminders yet.'
})

const browserDisabled = computed(() => reminders.browserPermission.value === 'unsupported')

const savingStatus = computed(() => (reminders.isSaving.value ? 'Saving your reminder…' : ''))

const repeatUnitLabel = computed(() => {
  const interval = Number(form.value?.repeat_interval) || 1
  const unit = { Daily: 'day', Weekly: 'week', Monthly: 'month', Yearly: 'year' }[form.value?.repeat_type] || 'time'
  return interval === 1 ? unit : `${unit}s`
})

// The full IANA zone list when the runtime exposes it, otherwise a minimal fallback.
const supportedTimeZones =
  typeof Intl.supportedValuesOf === 'function' ? readSupportedTimeZones() : ['UTC']

// Always include the form's current zone so an unusual saved value still shows in the select.
const timeZoneOptions = computed(() => {
  const zone = form.value?.time_zone
  if (zone && !supportedTimeZones.includes(zone)) return [zone, ...supportedTimeZones]
  return supportedTimeZones
})

onMounted(() => {
  preferences.recordRecent(TOOL_ID)
  void reminders.loadList()
})

function readSupportedTimeZones() {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['UTC']
  }
}

function onNew() {
  showExportMenu.value = false
  confirmingDeleteName.value = null
  reminders.newReminder()
}

function onEdit(name) {
  confirmingDeleteName.value = null
  void reminders.editReminder(name)
}

async function onSetScope(next) {
  confirmingDeleteName.value = null
  showExportMenu.value = false
  await reminders.setScope(next)
}

function onExport(format) {
  showExportMenu.value = false
  if (format === 'json') reminders.exportJson()
  else reminders.exportCsv()
}

async function onDelete(name) {
  await reminders.removeReminder(name)
  confirmingDeleteName.value = null
}

function toggleSnooze(name) {
  openSnoozeFor.value = openSnoozeFor.value === name ? null : name
}

function onSnooze(reminderName, preset) {
  openSnoozeFor.value = null
  void reminders.snooze(reminderName, { preset })
}

// Ticking Browser prompts for permission the first time; the composable owns the request.
function onToggleBrowser() {
  if (form.value?.delivery_browser && reminders.browserPermission.value !== 'granted') {
    void reminders.enableBrowserNotifications()
  }
}

async function onSave() {
  await reminders.saveActive()
}
</script>
