import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoute } from 'vue-router'

import { tools } from '@/data/toolRegistry'
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

vi.mock('vue-router', async (importOriginal) => {
  const { reactive } = await import('vue')
  const route = reactive({ meta: {}, path: '/emi-calculator' })
  return { ...(await importOriginal()), useRoute: () => route }
})

// Each calculator is its own tool at its own URL, so which one is showing comes from the route.
// The route object is reactive, so assigning `meta` moves the view the way a navigation does.
const route = useRoute()

function toolFor(variant) {
  return tools.find((tool) => tool.family === 'financial-calculators' && tool.variant === variant)
}

// The real RouterLink needs an injected router. This renders what it renders: an anchor whose
// href is `to`, with every other attribute passed through.
const RouterLink = {
  props: { to: { type: String, required: true } },
  setup(props, { attrs, slots }) {
    return () => h('a', { ...attrs, href: props.to }, slots.default?.())
  },
}

function mountView(variant = 'emi') {
  const tool = toolFor(variant)
  route.meta = { toolId: tool.id }
  route.path = tool.route
  return mount(FinancialCalculatorsView, {
    attachTo: document.body,
    global: { stubs: { RouterLink } },
  })
}

async function selectCalculator(wrapper, variant) {
  const tool = toolFor(variant)
  route.meta = { toolId: tool.id }
  route.path = tool.route
  await nextTick()
  await flushPromises()
}

function activeCalculatorName(wrapper) {
  return wrapper.find('h1').text()
}

describe('FinancialCalculatorsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tracks recent use against the tool the route names', () => {
    mountView('sip')
    expect(preferences.recordRecent).toHaveBeenCalledWith('sip-calculator')
  })

  it('records a committed result and reuses its inputs from history', async () => {
    const wrapper = mountView()
    // EMI is active by default with computed results; committing an input records it.
    await wrapper.get('#emi-principal').setValue('500000')
    await wrapper.get('#emi-principal').trigger('change')
    await flushPromises()

    const historyList = wrapper.get('[aria-label="Financial calculation history"]')
    expect(historyList.text()).toContain('EMI')

    // Each calculator keeps its own history now, so the SIP page does not show an EMI result.
    await selectCalculator(wrapper, 'sip')
    expect(activeCalculatorName(wrapper)).toBe('SIP Calculator')
    expect(wrapper.find('[aria-label="Financial calculation history"]').exists()).toBe(false)

    // Back on EMI, the row is still there and still reusable.
    await selectCalculator(wrapper, 'emi')
    expect(activeCalculatorName(wrapper)).toBe('EMI Calculator')
    await wrapper.get('button[aria-label="Reuse EMI"]').trigger('click')
    await flushPromises()

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
