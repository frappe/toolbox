<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
    <header>
      <p class="text-sm font-medium text-ink-gray-5">Preferences</p>
      <h1 class="pt-2 text-3xl font-semibold tracking-tight text-ink-gray-9">Settings</h1>
      <p class="pt-2 text-base text-ink-gray-6">Choose how Toolbox formats values and units.</p>
    </header>

    <section class="divide-y divide-outline-gray-2 pt-8">
      <SettingRow label="Theme" description="Match your system appearance, or always use a light or dark theme.">
        <FormControl
          type="select"
          size="md"
          aria-label="Theme"
          :model-value="preferences.settings.theme"
          :options="themeOptions"
          @update:model-value="preferences.updateSetting('theme', $event)"
        />
      </SettingRow>
      <SettingRow label="Number format" description="Use Indian lakh and crore grouping or international thousands grouping.">
        <FormControl
          type="select"
          size="md"
          aria-label="Number format"
          :model-value="preferences.settings.numberFormat"
          :options="numberFormatOptions"
          @update:model-value="preferences.updateSetting('numberFormat', $event)"
        />
      </SettingRow>
      <SettingRow label="Decimal precision" description="Set the default number of digits after the decimal point.">
        <FormControl
          type="select"
          size="md"
          aria-label="Decimal precision"
          :model-value="preferences.settings.decimalPrecision"
          :options="precisionOptions"
          @update:model-value="preferences.updateSetting('decimalPrecision', $event)"
        />
      </SettingRow>
      <SettingRow label="Date format" description="Set the date order shown across tools.">
        <FormControl
          type="select"
          size="md"
          aria-label="Date format"
          :model-value="preferences.settings.dateFormat"
          :options="dateFormatOptions"
          @update:model-value="preferences.updateSetting('dateFormat', $event)"
        />
      </SettingRow>
      <SettingRow label="Time format" description="Use a 12-hour or 24-hour clock.">
        <FormControl
          type="select"
          size="md"
          aria-label="Time format"
          :model-value="preferences.settings.timeFormat"
          :options="timeFormatOptions"
          @update:model-value="preferences.updateSetting('timeFormat', $event)"
        />
      </SettingRow>
      <SettingRow label="Default currency" description="Use this currency when a financial tool needs a default.">
        <FormControl
          type="select"
          size="md"
          aria-label="Default currency"
          :model-value="preferences.settings.defaultCurrency"
          :options="currencyOptions"
          @update:model-value="preferences.updateSetting('defaultCurrency', $event)"
        />
      </SettingRow>
      <SettingRow label="Measurement system" description="Choose metric or imperial defaults for supported tools.">
        <FormControl
          type="select"
          size="md"
          aria-label="Measurement system"
          :model-value="preferences.settings.measurementSystem"
          :options="measurementOptions"
          @update:model-value="preferences.updateSetting('measurementSystem', $event)"
        />
      </SettingRow>
      <SettingRow label="Temperature" description="Choose Celsius or Fahrenheit as the default temperature unit.">
        <FormControl
          type="select"
          size="md"
          aria-label="Temperature unit"
          :model-value="preferences.settings.temperatureUnit"
          :options="temperatureOptions"
          @update:model-value="preferences.updateSetting('temperatureUnit', $event)"
        />
      </SettingRow>
    </section>

    <section class="pt-10">
      <header>
        <h2 class="text-lg font-semibold text-ink-gray-9">Sidebar tools</h2>
        <p class="pt-1 text-sm text-ink-gray-6">
          Hide tools you don't use to simplify the sidebar. Hidden tools stay available from All tools and search.
        </p>
      </header>
      <div class="space-y-6 pt-4">
        <div v-for="category in toolGroups" :key="category.id">
          <p class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">{{ category.name }}</p>
          <!-- A grid, not `space-y`. The frappe-ui Checkbox root is `inline-flex`, so vertical
               margin between siblings does nothing for it: the boxes flowed inline with no
               horizontal gap and each label ran into the next control. -->
          <div class="grid gap-x-6 gap-y-2 pt-2 sm:grid-cols-2 lg:grid-cols-3">
            <Checkbox
              v-for="tool in category.tools"
              :key="tool.id"
              :model-value="!preferences.isHidden(tool.id)"
              :label="tool.name"
              @update:model-value="preferences.toggleHidden(tool.id)"
            />
          </div>
        </div>
      </div>
    </section>

    <div class="flex flex-col gap-4 border-t border-outline-gray-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <p class="max-w-xl text-sm leading-6 text-ink-gray-5">
        These settings stay in this browser and clear when you close it. Your theme is the one
        exception, so the page does not flash white next time. Nothing is sent to a server.
      </p>
      <Button class="shrink-0" label="Reset settings" variant="subtle" @click="preferences.resetSettings()" />
    </div>
  </div>
</template>

<script setup>
import { Button, Checkbox, FormControl } from 'frappe-ui'

import SettingRow from '@/components/settings/SettingRow.vue'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { getToolsByCategory, toolCategories } from '@/data/toolRegistry'

const preferences = useToolboxPreferences()
const toolGroups = toolCategories.map((category) => ({
  ...category,
  tools: getToolsByCategory(category.id),
}))
const themeOptions = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]
const numberFormatOptions = [
  { label: 'Indian · 12,34,567.89', value: 'indian' },
  { label: 'International · 1,234,567.89', value: 'international' },
]
const precisionOptions = [0, 2, 4, 6].map((value) => ({ label: String(value), value }))
const dateFormatOptions = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']
const timeFormatOptions = [
  { label: '12-hour · 4:30 PM', value: '12-hour' },
  { label: '24-hour · 16:30', value: '24-hour' },
]
const currencyOptions = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD']
const measurementOptions = [
  { label: 'Metric', value: 'metric' },
  { label: 'Imperial', value: 'imperial' },
]
const temperatureOptions = [
  { label: 'Celsius · °C', value: 'celsius' },
  { label: 'Fahrenheit · °F', value: 'fahrenheit' },
]
</script>
