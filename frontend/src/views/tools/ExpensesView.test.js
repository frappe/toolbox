import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ExpensesView from '@/views/tools/ExpensesView.vue'

const preferences = vi.hoisted(() => ({
  isFavourite: vi.fn(() => false),
  toggleFavourite: vi.fn(),
  recordRecent: vi.fn(),
}))

vi.mock('@/composables/useToolboxPreferences', () => ({
  useToolboxPreferences: () => preferences,
}))

const api = vi.hoisted(() => ({
  setup: vi.fn(),
  listExpenses: vi.fn(),
  getDashboard: vi.fn(),
  suggestCategory: vi.fn(),
  saveExpense: vi.fn(),
  deleteExpense: vi.fn(),
  learnRule: vi.fn(),
  listCategories: vi.fn(),
  saveCategory: vi.fn(),
  deleteCategory: vi.fn(),
  listPaymentMethods: vi.fn(),
  savePaymentMethod: vi.fn(),
  deletePaymentMethod: vi.fn(),
  listRules: vi.fn(),
  saveRule: vi.fn(),
  deleteRule: vi.fn(),
  bulkUpdate: vi.fn(async () => ({})),
  bulkDelete: vi.fn(async () => ({})),
  listProjects: vi.fn(async () => []),
  saveProject: vi.fn(async () => ({})),
  deleteProject: vi.fn(async () => ({})),
  projectSummary: vi.fn(async () => ({})),
  listBudgets: vi.fn(async () => []),
  setBudget: vi.fn(async () => ({})),
  deleteBudget: vi.fn(async () => ({})),
  budgetProgress: vi.fn(async () => ({ currency: 'INR', overall: null, categories: [] })),
}))

vi.mock('@/tools/expenses/api', () => api)

const category = { name: 'c1', category_name: 'Food and Dining', is_archived: false }

function setupResolved(overrides = {}) {
  api.setup.mockResolvedValue({
    categories: [category],
    payment_methods: [{ name: 'p1', method_name: 'Cash', is_archived: false }],
  })
  api.listExpenses.mockResolvedValue(
    overrides.list || {
      expenses: [
        {
          name: 'e1',
          expense_date: '2026-08-01',
          description: 'Lunch',
          amount: 250,
          currency: 'INR',
          category_name: 'Food and Dining',
          tags: [],
        },
      ],
      total: 1,
    },
  )
  api.getDashboard.mockResolvedValue(
    overrides.dashboard || {
      currency: 'INR',
      spend_this_month: 1234,
      spend_last_month: 1000,
      change_pct: 23.4,
      category_breakdown: [{ label: 'Food and Dining', amount: 1234 }],
      top_merchants: [],
      recent: [],
      other_currency_count: 0,
      expense_count: 1,
    },
  )
}

async function mountView() {
  const wrapper = mount(ExpensesView, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('ExpensesView', () => {
  it('records recent use and shows a friendly empty state when there is nothing yet', async () => {
    setupResolved({
      list: { expenses: [], total: 0 },
      dashboard: {
        currency: 'INR',
        spend_this_month: 0,
        spend_last_month: 0,
        change_pct: null,
        category_breakdown: [],
        top_merchants: [],
        recent: [],
        other_currency_count: 0,
        expense_count: 0,
      },
    })
    const wrapper = await mountView()

    expect(preferences.recordRecent).toHaveBeenCalledWith('expenses')
    expect(wrapper.text()).toContain('No expenses yet')
    expect(wrapper.findAll('button').some((button) => button.text() === 'Add expense')).toBe(true)
  })

  it('renders an expense row on the Expenses tab', async () => {
    setupResolved()
    const wrapper = await mountView()

    expect(wrapper.get('[data-expense-name="e1"]').text()).toContain('Lunch')
  })

  it('opens the quick-add form when Add expense is clicked', async () => {
    setupResolved()
    const wrapper = await mountView()

    const addButton = wrapper.findAll('button').find((button) => button.text() === 'Add expense')
    await addButton.trigger('click')
    await flushPromises()

    expect(wrapper.find('#expense-amount').exists()).toBe(true)
    expect(wrapper.find('#expense-description').exists()).toBe(true)
  })

  it('shows the month spend on the Dashboard tab', async () => {
    setupResolved()
    const wrapper = await mountView()

    const dashboardTab = wrapper.findAll('button').find((button) => button.text() === 'Dashboard')
    await dashboardTab.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Spend this month')
    expect(wrapper.text()).toContain('Last month')
    expect(wrapper.text()).toContain('+23%')
  })

  it('renders a project on the Trips tab', async () => {
    setupResolved()
    api.listProjects.mockResolvedValue([
      { name: 'pr1', project_name: 'Goa trip', project_type: 'Trip', status: 'Active' },
    ])
    const wrapper = await mountView()

    const tripsTab = wrapper.findAll('button').find((button) => button.text() === 'Trips')
    await tripsTab.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Goa trip')
  })

  it('shows a budget section on the Dashboard when a budget is set', async () => {
    setupResolved()
    api.budgetProgress.mockResolvedValue({
      currency: 'INR',
      month: 8,
      year: 2026,
      overall: { budget: 5000, spent: 1234, remaining: 3766, pct: 24.68 },
      overall_spent: 1234,
      categories: [],
    })
    const wrapper = await mountView()

    const dashboardTab = wrapper.findAll('button').find((button) => button.text() === 'Dashboard')
    await dashboardTab.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Budget')
    expect(wrapper.text()).toContain('Overall')
  })

  it('reveals the bulk action bar when an expense is selected', async () => {
    setupResolved()
    const wrapper = await mountView()

    const checkbox = wrapper.find('[data-expense-name="e1"] input[type="checkbox"]')
    await checkbox.setValue(true)
    await flushPromises()

    expect(wrapper.text()).toContain('1 selected')
    expect(wrapper.findAll('button').some((button) => button.text() === 'Apply')).toBe(true)
  })
})
