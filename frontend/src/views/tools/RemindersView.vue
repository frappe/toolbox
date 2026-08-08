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
        <Badge theme="gray" variant="subtle" size="sm" :label="reminders.dueCount.value" />
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
              <Button variant="subtle" icon-left="lucide-check" label="Complete" @click="reminders.complete(item.reminder)" />
              <Dropdown :options="snoozeMenuFor(item)">
                <Button variant="ghost" icon-left="lucide-clock" label="Snooze" />
              </Dropdown>
              <Button variant="ghost" icon-left="lucide-x" label="Dismiss" @click="reminders.acknowledgeDue(item.name)" />
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
      <Button class="mt-5" variant="solid" icon-left="lucide-plus" label="New reminder" @click="onNew" />
    </section>

    <!-- Main -->
    <div v-else class="mt-8">
      <!-- Toolbar -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="shrink-0 overflow-x-auto">
          <TabButtons
            :options="scopeTabs"
            :model-value="reminders.scope.value"
            size="md"
            aria-label="Reminder scope"
            @update:model-value="onSetScope"
          />
        </div>

        <TextInput
          type="search"
          size="md"
          class="min-w-0 flex-1"
          placeholder="Search reminders"
          aria-label="Search reminders"
          spellcheck="false"
          :model-value="reminders.searchQuery.value"
          @update:model-value="reminders.searchQuery.value = $event"
        >
          <template #prefix>
            <Icon name="lucide-search" class="size-4 text-ink-gray-5" />
          </template>
        </TextInput>

        <div class="flex items-center gap-2">
          <Button variant="solid" icon-left="lucide-plus" label="New reminder" @click="onNew" />
          <Dropdown :options="exportOptions">
            <Button variant="outline" icon-left="lucide-download" label="Export" />
          </Dropdown>
        </div>
      </div>

      <!-- Edit form -->
      <form v-if="form" class="mt-6 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-6" aria-label="Reminder details" @submit.prevent="onSave">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-ink-gray-9">{{ form.name ? 'Edit reminder' : 'New reminder' }}</h2>
          <Button variant="ghost" icon="lucide-x" aria-label="Close form" @click="reminders.closeForm()" />
        </div>

        <div class="mt-4 flex flex-col gap-4">
          <FormControl
            id="reminder-title"
            type="text"
            size="md"
            label="Title"
            required
            placeholder="What is this reminder about?"
            :model-value="form.title"
            @update:model-value="form.title = $event"
          />

          <FormControl
            id="reminder-note"
            type="textarea"
            size="md"
            label="Note"
            :rows="2"
            placeholder="Add a note (optional)"
            :model-value="form.note"
            @update:model-value="form.note = $event"
          />

          <div class="grid gap-4 sm:grid-cols-2">
            <FormControl
              id="reminder-date"
              type="date"
              size="md"
              label="Date"
              :model-value="form.local_date"
              @update:model-value="form.local_date = $event"
            />
            <FormControl
              id="reminder-time"
              type="time"
              size="md"
              label="Time"
              :model-value="form.local_time"
              @update:model-value="form.local_time = $event"
            />
          </div>

          <FormControl
            id="reminder-timezone"
            type="combobox"
            size="md"
            label="Time zone"
            :options="zoneOptions"
            :model-value="form.time_zone"
            @update:model-value="form.time_zone = $event"
          />

          <FormControl
            id="reminder-repeat"
            type="select"
            size="md"
            label="Repeat"
            :options="repeatTypes"
            :model-value="form.repeat_type"
            @update:model-value="form.repeat_type = $event"
          />

          <div v-if="form.repeat_type !== 'None'" class="grid gap-4 sm:grid-cols-2">
            <FormControl
              id="reminder-interval"
              type="number"
              size="md"
              label="Repeat every"
              min="1"
              step="1"
              :model-value="form.repeat_interval"
              @update:model-value="form.repeat_interval = $event"
            >
              <template #suffix>
                <span class="text-sm text-ink-gray-5">{{ repeatUnitLabel }}</span>
              </template>
            </FormControl>
            <FormControl
              id="reminder-end"
              type="date"
              size="md"
              label="Ends on"
              description="Optional — leave blank to repeat indefinitely."
              :model-value="form.repeat_end_date"
              @update:model-value="form.repeat_end_date = $event"
            />
          </div>

          <fieldset class="flex flex-col gap-2">
            <legend class="text-sm font-medium text-ink-gray-7">Notify me</legend>
            <Checkbox
              label="In-app"
              :model-value="form.delivery_in_app"
              @update:model-value="form.delivery_in_app = $event"
            />
            <Checkbox
              label="Email"
              :model-value="form.delivery_email"
              @update:model-value="form.delivery_email = $event"
            />
            <Checkbox
              label="Browser notification"
              :disabled="browserDisabled"
              :model-value="form.delivery_browser"
              @update:model-value="(value) => { form.delivery_browser = value; onToggleBrowser() }"
            />
            <p v-if="reminders.browserPermission.value === 'unsupported'" class="text-xs text-ink-gray-5">This browser does not support notifications.</p>
            <p v-else-if="reminders.browserPermission.value === 'denied'" class="text-xs text-ink-gray-5">Your browser has blocked notifications. Allow them in your browser settings to use this.</p>
          </fieldset>

          <TagInput variant="subtle" :model-value="form.tags" label="Tags" placeholder="Add a tag…" @update:model-value="form.tags = $event" />
        </div>

        <p class="sr-only" role="status" aria-live="polite">{{ savingStatus }}</p>
        <ErrorMessage class="mt-4" :message="reminders.saveError.value" />

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
                      <Badge v-if="section.key === 'overdue'" class="shrink-0" theme="red" variant="subtle" size="sm" label="Overdue" />
                    </div>
                    <p v-if="row.next_trigger" class="mt-0.5 text-xs text-ink-gray-6">{{ formatInstant(row.next_trigger, { timeZone: row.time_zone }) }}</p>
                    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-gray-5">
                      <span>{{ describeRepeat(row) }}</span>
                      <span v-if="row.snoozed_until">Snoozed until {{ formatInstant(row.snoozed_until, { timeZone: row.time_zone }) }}</span>
                    </div>
                    <div v-if="row.tags && row.tags.length" class="mt-2 flex flex-wrap gap-1" role="list" aria-label="Tags">
                      <Badge v-for="tag in row.tags" :key="tag" role="listitem" theme="gray" variant="subtle" size="sm" :label="tag" />
                    </div>
                  </div>
                  <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Button variant="subtle" icon-left="lucide-pencil" label="Edit" @click="onEdit(row.name)" />
                    <Button v-if="reminders.scope.value !== 'completed'" variant="ghost" icon-left="lucide-check" label="Complete" @click="reminders.complete(row.name)" />
                    <template v-if="confirmingDeleteName === row.name">
                      <span class="text-xs text-ink-gray-7">Delete?</span>
                      <Button variant="ghost" label="Cancel" @click="confirmingDeleteName = null" />
                      <Button variant="solid" theme="red" icon-left="lucide-trash-2" label="Delete" @click="onDelete(row.name)" />
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
import { Badge, Button, Checkbox, Dropdown, ErrorMessage, FormControl, Icon, TabButtons, TextInput } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import TagInput from '@/components/inputs/TagInput.vue'
import { describeRepeat, formatInstant, useReminders } from '@/tools/reminders/useReminders'

const TOOL_ID = 'reminders'

const preferences = useToolboxPreferences()
const reminders = useReminders()

const confirmingDeleteName = ref(null)

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

const exportOptions = [
  { label: 'JSON', onClick: () => onExport('json') },
  { label: 'CSV', onClick: () => onExport('csv') },
]

// A per-item snooze menu for the Dropdown; each preset snoozes that reminder.
function snoozeMenuFor(item) {
  return snoozeOptions.map((option) => ({
    label: option.label,
    onClick: () => reminders.snooze(item.reminder, { preset: option.preset }),
  }))
}

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

// Combobox wants {label, value}; the zone string is both.
const zoneOptions = computed(() => timeZoneOptions.value.map((zone) => ({ label: zone, value: zone })))

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
  confirmingDeleteName.value = null
  reminders.newReminder()
}

function onEdit(name) {
  confirmingDeleteName.value = null
  void reminders.editReminder(name)
}

async function onSetScope(next) {
  confirmingDeleteName.value = null
  await reminders.setScope(next)
}

function onExport(format) {
  if (format === 'json') reminders.exportJson()
  else reminders.exportCsv()
}

async function onDelete(name) {
  await reminders.removeReminder(name)
  confirmingDeleteName.value = null
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
