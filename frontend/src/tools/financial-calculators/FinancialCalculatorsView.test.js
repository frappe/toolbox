import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FinancialCalculatorsView from '@/views/tools/FinancialCalculatorsView.vue'

const preferences = vi.hoisted(() => ({
  settings: {
    numberFormat: 'indian',
    decimalPrecision: 2,
    defaultCurrency: 'INR',
  },
  isFavourite: vi.fn(() => false),
  toggleFavourite: vi.fn(),
  recordRecent: vi.fn(),
}))

vi.mock('@/composables/useToolboxPreferences', () => ({
  useToolboxPreferences: () => preferences,
}))

function mountView() {
  return mount(FinancialCalculatorsView, { attachTo: document.body })
}

async function selectCalculator(wrapper, id) {
  await wrapper.get(`[data-tab-id="${id}"]`).trigger('click')
}

describe('FinancialCalculatorsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tracks recent use', () => {
    mountView()
    expect(preferences.recordRecent).toHaveBeenCalledWith('financial-calculators')
  })

  it('records a committed result and reuses its inputs from history', async () => {
    const wrapper = mountView()
    // EMI is active by default with computed results; committing an input records it.
    await wrapper.get('#emi-principal').setValue('500000')
    await wrapper.get('#emi-principal').trigger('change')
    await flushPromises()

    const historyList = wrapper.get('[aria-label="Financial calculation history"]')
    expect(historyList.text()).toContain('EMI')

    // Move to a different calculator, then reuse the EMI row.
    await selectCalculator(wrapper, 'sip')
    expect(wrapper.get('[data-tab-id="sip"]').attributes('aria-selected')).toBe('true')
    await wrapper.get('button[aria-label="Reuse EMI"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-tab-id="emi"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('#emi-principal').element.value).toBe('500000')
  })

  it('shows a reconciled EMI estimate, balance chart, and full schedule', () => {
    const wrapper = mountView()

    expect(wrapper.get('output[aria-label="Primary financial result"]').text()).toContain('₹')
    expect(wrapper.text()).toContain('Total interest')
    // The declining-balance chart renders alongside the schedule.
    expect(wrapper.get('svg[aria-label="Outstanding loan balance each year"]').exists()).toBe(true)
    expect(wrapper.get('summary').text()).toBe('View all 60 payments')
    expect(wrapper.findAll('tbody tr')).toHaveLength(60)
  })

  it('draws the cost-versus-revenue chart for break-even', async () => {
    const wrapper = mountView()
    await selectCalculator(wrapper, 'break-even')

    const chart = wrapper.get('svg[aria-label="Cost versus revenue break-even chart"]')
    expect(chart.findAll('polyline')).toHaveLength(2)
    expect(wrapper.text()).toContain('Break-even')
  })

  it('calculates compound interest with explicit end-of-period contributions', async () => {
    const wrapper = mountView()
    await selectCalculator(wrapper, 'compound-interest')
    await wrapper.get('#compound-interest-principal').setValue('10000')
    await wrapper.get('#compound-interest-annualRate').setValue('10')
    await wrapper.get('#compound-interest-durationYears').setValue('2')
    await wrapper.get('#compound-interest-compoundsPerYear').setValue('1')
    await wrapper.get('#compound-interest-contributionPerPeriod').setValue('1000')

    expect(wrapper.get('output').text()).toContain('14,200.00')
    expect(wrapper.text()).toContain('Recurring contributions occur at each period end.')
  })

  it('calculates SIP and CAGR vectors', async () => {
    const wrapper = mountView()
    await selectCalculator(wrapper, 'sip')
    await wrapper.get('#sip-monthlyInvestment').setValue('1000')
    await wrapper.get('#sip-annualRate').setValue('0')
    await wrapper.get('#sip-durationYears').setValue('1')
    expect(wrapper.get('output').text()).toContain('12,000.00')

    await selectCalculator(wrapper, 'cagr')
    await wrapper.get('#cagr-startingValue').setValue('100')
    await wrapper.get('#cagr-endingValue').setValue('121')
    await wrapper.get('#cagr-durationYears').setValue('2')
    expect(wrapper.get('output').text()).toBe('10.00%')
  })

  it('rounds break-even units up and rejects an impossible margin', async () => {
    const wrapper = mountView()
    await selectCalculator(wrapper, 'break-even')
    await wrapper.get('#break-even-fixedCost').setValue('1001')
    await wrapper.get('#break-even-sellingPrice').setValue('50')
    await wrapper.get('#break-even-variableCost').setValue('30')
    expect(wrapper.get('output').text()).toBe('51 units')

    await wrapper.get('#break-even-variableCost').setValue('50')
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Selling price must be greater than variable cost',
    )
    expect(wrapper.find('output').exists()).toBe(false)
  })

  it('copies a structured result with the disclaimer', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mountView()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Copy result')
      .trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0][0]).toContain('EMI')
    expect(writeText.mock.calls[0][0]).toContain('Not financial advice')
    expect(wrapper.get('[data-testid="financial-copy-status"]').text()).toBe(
      'Financial result copied.',
    )
  })

  it('clears the inputs with a single Clear', async () => {
    const wrapper = mountView()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Clear')
      .trigger('click')
    expect(wrapper.get('#emi-principal').element.value).toBe('')
    expect(wrapper.find('output').exists()).toBe(false)
  })
})
