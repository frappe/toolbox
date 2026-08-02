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
  'Number format',
  'Decimal precision',
  'Date format',
  'Time format',
  'Default currency',
  'Measurement system',
  'Temperature unit',
]

describe('SettingsView', () => {
  beforeEach(() => {
    Object.assign(preferences.settings, defaultSettings)
    preferences.hiddenIds.value = []
    preferences.mode.value = 'local'
    preferences.isSaving.value = false
    preferences.syncError.value = ''
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

    await wrapper.get('button').trigger('click')

    expect({ ...preferences.settings }).toEqual(defaultSettings)
    expect(wrapper.get('select[aria-label="Measurement system"]').element.value).toBe('metric')
  })

  it('hides a tool from the sidebar when its checkbox is unticked', async () => {
    const wrapper = mount(SettingsView)
    const calculator = toolsById.get('calculator')
    const checkbox = wrapper.get(`input[type="checkbox"][aria-label="${calculator.name}"]`)

    expect(checkbox.element.checked).toBe(true)
    await checkbox.setValue(false)
    expect(preferences.isHidden('calculator')).toBe(true)
  })

  it('explains where preferences are saved and announces sync failures', async () => {
    const wrapper = mount(SettingsView)

    expect(wrapper.get('[role="status"]').text()).toBe('Saved in this browser.')

    preferences.mode.value = 'frappe'
    preferences.isSaving.value = true
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[role="status"]').text()).toBe('Saving to your Frappe account…')

    preferences.syncError.value = 'Your preferences could not be saved.'
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[role="alert"]').text()).toBe('Your preferences could not be saved.')
  })
})
