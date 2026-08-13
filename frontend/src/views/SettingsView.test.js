import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  defaultSettings,
  useToolboxPreferences,
} from '@/composables/useToolboxPreferences'
import { toolsById } from '@/data/toolRegistry'
import SettingsView from './SettingsView.vue'

const preferences = useToolboxPreferences()
const settingLabels = [
  'Theme',
  'Number format',
  'Decimal precision',
  'Date format',
  'Time format',
  'Default currency',
  'Measurement system',
  'Temperature unit',
]

// The tool list lives on the second panel. reka unmounts an inactive one, so a test that reads it
// has to open the tab first, the same as a visitor.
async function openSidebarTools(wrapper) {
  const tab = wrapper.findAll('[role="tab"]').find((candidate) => candidate.text() === 'Sidebar tools')
  await tab.trigger('click')
  return tab
}

describe('SettingsView', () => {
  beforeEach(() => {
    Object.assign(preferences.settings, defaultSettings)
    preferences.hiddenIds.value = []
  })

  it('gives every setting control a stable accessible name', () => {
    const wrapper = mount(SettingsView)

    expect(wrapper.findAll('select')).toHaveLength(settingLabels.length)
    for (const label of settingLabels) {
      expect(wrapper.find(`select[aria-label="${label}"]`).exists()).toBe(true)
    }
  })

  it('updates typed preference values from the controls', async () => {
    const wrapper = mount(SettingsView)

    await wrapper.get('select[aria-label="Decimal precision"]').setValue('6')
    await wrapper.get('select[aria-label="Time format"]').setValue('24-hour')
    await wrapper.get('select[aria-label="Default currency"]').setValue('USD')

    expect(preferences.settings.decimalPrecision).toBe(6)
    expect(preferences.settings.timeFormat).toBe('24-hour')
    expect(preferences.settings.defaultCurrency).toBe('USD')
  })

  it('restores all defaults from the reset action', async () => {
    const wrapper = mount(SettingsView)
    preferences.updateSetting('measurementSystem', 'imperial')
    preferences.updateSetting('temperatureUnit', 'fahrenheit')

    await openSidebarTools(wrapper)
    await wrapper.get('button[aria-label="Reset settings"]').trigger('click')

    expect({ ...preferences.settings }).toEqual(defaultSettings)
  })

  it('hides a tool from the sidebar when its checkbox is unticked', async () => {
    const wrapper = mount(SettingsView)
    await openSidebarTools(wrapper)
    const calculator = toolsById.get('calculator')
    const checkbox = wrapper.get(`input[type="checkbox"][aria-label="${calculator.name}"]`)

    expect(checkbox.element.checked).toBe(true)
    await checkbox.setValue(false)
    expect(preferences.isHidden('calculator')).toBe(true)
  })

  it('gives the dialog a sidebar of panels, and opens on Preferences', () => {
    const wrapper = mount(SettingsView)
    const tabs = wrapper.findAll('[role="tab"]')

    expect(wrapper.get('[role="dialog"]').exists()).toBe(true)
    expect(tabs.map((tab) => tab.text())).toEqual(['Preferences', 'Sidebar tools'])
    expect(tabs[0].attributes('aria-selected')).toBe('true')
    // reka unmounts an inactive panel, so the tool list is not in the document until it is opened.
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  // There is no account to save to any more, and the page must not imply otherwise.
  it('says settings stay in the browser, and claims no account', async () => {
    const wrapper = mount(SettingsView)
    await openSidebarTools(wrapper)
    const text = wrapper.text()

    expect(text).toContain('stay in this browser')
    expect(text).not.toContain('Frappe account')
    expect(text).not.toContain('Saving')
  })
})
