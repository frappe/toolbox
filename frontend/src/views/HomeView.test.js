import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import HomeView from './HomeView.vue'

const RouterLink = defineComponent({
  props: { to: { type: [String, Object], required: true } },
  setup(props, { slots }) {
    return () => h('a', { 'data-to': JSON.stringify(props.to) }, slots.default?.())
  },
})

describe('Home saved items', () => {
  const preferences = useToolboxPreferences()

  afterEach(() => {
    preferences.mode.value = 'local'
    preferences.syncError.value = ''
    preferences.savedCurrencyPairs.value = []
    preferences.savedWorldClockLocations.value = []
  })

  it('shows guest currency pairs and favourite clock locations first', () => {
    preferences.savedCurrencyPairs.value = [{ baseCurrency: 'INR', quoteCurrency: 'USD' }]
    preferences.savedWorldClockLocations.value = [
      { zone: 'Europe/London', label: 'London', favourite: false },
      { zone: 'Asia/Kolkata', label: 'Kolkata', favourite: true },
    ]

    const wrapper = mount(HomeView, { global: { stubs: { RouterLink } } })

    expect(wrapper.text()).toContain('INR → USD')
    expect(wrapper.text().indexOf('Kolkata')).toBeLessThan(wrapper.text().indexOf('London'))
    expect(wrapper.find('[data-to*="currency-converter"]').attributes('data-to')).toContain('INR')
    expect(wrapper.text()).toContain('Local by default')
  })

  it('renders the same saved utilities from account-backed preferences', () => {
    preferences.mode.value = 'frappe'
    preferences.savedCurrencyPairs.value = [{ baseCurrency: 'GBP', quoteCurrency: 'INR' }]
    preferences.savedWorldClockLocations.value = [{ zone: 'Asia/Tokyo', label: 'Tokyo' }]

    const wrapper = mount(HomeView, { global: { stubs: { RouterLink } } })

    expect(wrapper.text()).toContain('GBP → INR')
    expect(wrapper.text()).toContain('Tokyo')
    expect(wrapper.text()).toContain('Preferences synced')
  })

  it('shows a useful empty state before anything is saved', () => {
    const wrapper = mount(HomeView, { global: { stubs: { RouterLink } } })

    expect(wrapper.text()).toContain('Save a currency pair or World Clock location')
  })
})
