<template>
  <!--
    Settings is a dialog with its own sidebar, the way Frappe Drive shows it, built from
    frappe-ui's own SettingsDialog rather than a local copy of one.

    It stays behind the `/settings` route rather than becoming a button somewhere. The route is
    linked from the navigation, it is published, and the server answers it with `noindex, follow`.
    A dialog with no URL would lose the link, the bookmark and that header. Closing it goes back to
    the page the visitor came from, and to All Tools when they arrived here directly.
  -->
  <SettingsDialog v-model="open" v-model:tab="tab">
    <template #title>Settings</template>
    <template #description>Choose how Toolbox formats values and units.</template>

    <SettingsSidebar>
      <SettingsNavGroup label="Toolbox">
        <SettingsNavItem
          v-for="panel in PANELS"
          :key="panel.value"
          :value="panel.value"
        >
          <template #prefix>
            <Icon :name="panel.icon" class="size-4 shrink-0 text-ink-gray-6" />
          </template>
          {{ panel.label }}
        </SettingsNavItem>
      </SettingsNavGroup>
    </SettingsSidebar>

    <SettingsContent>
      <SettingsPanel value="preferences">
        <SettingsHeader
          title="Preferences"
          description="Choose how Toolbox formats values and units."
        />
        <SettingsBody>
          <SettingsRow
            v-for="setting in SETTINGS"
            :key="setting.key"
            :title="setting.title"
            :description="setting.description"
          >
            <FormControl
              type="select"
              size="md"
              :aria-label="setting.label"
              :model-value="preferences.settings[setting.key]"
              :options="setting.options"
              @update:model-value="preferences.updateSetting(setting.key, $event)"
            />
          </SettingsRow>
        </SettingsBody>
      </SettingsPanel>

      <SettingsPanel value="sidebar-tools">
        <SettingsHeader
          title="Sidebar tools"
          description="Hide tools you don't use to simplify the sidebar. Hidden tools stay available from All tools and search."
        >
          <template #actions>
            <Button label="Reset settings" variant="subtle" @click="preferences.resetSettings()" />
          </template>
        </SettingsHeader>
        <SettingsBody>
          <div class="flex flex-col gap-6 pt-2">
            <div v-for="category in toolGroups" :key="category.id">
              <p class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">
                {{ category.name }}
              </p>
              <!-- A grid, not `space-y`. The frappe-ui Checkbox root is `inline-flex`, so vertical
                   margin between siblings does nothing for it: the boxes flowed inline with no
                   horizontal gap and each label ran into the next control. -->
              <div class="grid gap-x-6 gap-y-2 pt-2 sm:grid-cols-2">
                <Checkbox
                  v-for="tool in category.tools"
                  :key="tool.id"
                  :model-value="!preferences.isHidden(tool.id)"
                  :label="tool.name"
                  @update:model-value="preferences.toggleHidden(tool.id)"
                />
              </div>
            </div>
            <p class="text-sm leading-6 text-ink-gray-5">
              These settings stay in this browser and clear when you close it. Your theme is the one
              exception, so the page does not flash white next time. Nothing is sent to a server.
            </p>
          </div>
        </SettingsBody>
      </SettingsPanel>
    </SettingsContent>
  </SettingsDialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Button,
  Checkbox,
  FormControl,
  Icon,
  SettingsBody,
  SettingsContent,
  SettingsDialog,
  SettingsHeader,
  SettingsNavGroup,
  SettingsNavItem,
  SettingsPanel,
  SettingsRow,
  SettingsSidebar,
} from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { getToolsByCategory, toolCategories } from '@/data/toolRegistry'

const PANELS = [
  { value: 'preferences', label: 'Preferences', icon: 'lucide-sliders-horizontal' },
  { value: 'sidebar-tools', label: 'Sidebar tools', icon: 'lucide-list' },
]

const SETTINGS = [
  {
    key: 'theme',
    title: 'Theme',
    label: 'Theme',
    description: 'Match your system appearance, or always use a light or dark theme.',
    options: [
      { label: 'System', value: 'system' },
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
    ],
  },
  {
    key: 'numberFormat',
    title: 'Number format',
    label: 'Number format',
    description: 'Use Indian lakh and crore grouping or international thousands grouping.',
    options: [
      { label: 'Indian · 12,34,567.89', value: 'indian' },
      { label: 'International · 1,234,567.89', value: 'international' },
    ],
  },
  {
    key: 'decimalPrecision',
    title: 'Decimal precision',
    label: 'Decimal precision',
    description: 'Set the default number of digits after the decimal point.',
    options: [0, 2, 4, 6].map((value) => ({ label: String(value), value })),
  },
  {
    key: 'dateFormat',
    title: 'Date format',
    label: 'Date format',
    description: 'Set the date order shown across tools.',
    options: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
  },
  {
    key: 'timeFormat',
    title: 'Time format',
    label: 'Time format',
    description: 'Use a 12-hour or 24-hour clock.',
    options: [
      { label: '12-hour · 4:30 PM', value: '12-hour' },
      { label: '24-hour · 16:30', value: '24-hour' },
    ],
  },
  {
    key: 'defaultCurrency',
    title: 'Default currency',
    label: 'Default currency',
    description: 'Use this currency when a financial tool needs a default.',
    options: ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'],
  },
  {
    key: 'measurementSystem',
    title: 'Measurement system',
    label: 'Measurement system',
    description: 'Choose metric or imperial defaults for supported tools.',
    options: [
      { label: 'Metric', value: 'metric' },
      { label: 'Imperial', value: 'imperial' },
    ],
  },
  {
    key: 'temperatureUnit',
    title: 'Temperature',
    // The control keeps the name the settings it drives use, which is what a test and a screen
    // reader both read. The row title is shorter because it sits beside its description.
    label: 'Temperature unit',
    description: 'Choose Celsius or Fahrenheit as the default temperature unit.',
    options: [
      { label: 'Celsius · °C', value: 'celsius' },
      { label: 'Fahrenheit · °F', value: 'fahrenheit' },
    ],
  },
]

const router = useRouter()
const preferences = useToolboxPreferences()
const toolGroups = toolCategories.map((category) => ({
  ...category,
  tools: getToolsByCategory(category.id),
}))
const open = ref(true)
const tab = ref(PANELS[0].value)

// Closing the dialog leaves the route, or the URL would still name a page that is no longer on
// screen. `back()` returns the visitor to the tool they came from; a direct arrival has no such
// entry, so that falls to All Tools.
watch(open, (isOpen) => {
  if (isOpen) return
  if (globalThis.history?.state?.back) router.back()
  else router.replace('/')
})
</script>
