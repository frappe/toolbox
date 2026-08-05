import { afterEach, describe, expect, it, vi } from 'vitest'

import { confidenceLabel, formatMoney, useExpenses } from './useExpenses'

vi.mock('@/utils/fileExport', () => ({
  downloadJson: vi.fn(() => true),
  downloadTextFile: vi.fn(() => true),
}))

function makeApi(overrides = {}) {
  return {
    setup: vi.fn(async () => ({
      categories: [{ name: 'c1', category_name: 'Food and Dining', is_archived: false }],
      payment_methods: [{ name: 'p1', method_name: 'Cash', is_archived: false }],
    })),
    listExpenses: vi.fn(async () => ({ expenses: [], total: 0 })),
    getDashboard: vi.fn(async () => ({ currency: 'INR', spend_this_month: 0 })),
    suggestCategory: vi.fn(async () => ({ category: 'c1', category_name: 'Food and Dining', confidence: 'low' })),
    saveExpense: vi.fn(async () => ({ name: 'e1' })),
    deleteExpense: vi.fn(async () => {}),
    learnRule: vi.fn(async () => ({ name: 'r1' })),
    listCategories: vi.fn(async () => [{ name: 'c1', category_name: 'Food and Dining', is_archived: false }]),
    listPaymentMethods: vi.fn(async () => [{ name: 'p1', method_name: 'Cash', is_archived: false }]),
    listRules: vi.fn(async () => []),
    saveCategory: vi.fn(async () => ({})),
    deleteCategory: vi.fn(async () => {}),
    savePaymentMethod: vi.fn(async () => ({})),
    deletePaymentMethod: vi.fn(async () => {}),
    saveRule: vi.fn(async () => ({})),
    deleteRule: vi.fn(async () => {}),
    bulkUpdate: vi.fn(async () => 2),
    bulkDelete: vi.fn(async () => 2),
    listProjects: vi.fn(async () => []),
    saveProject: vi.fn(async () => ({ name: 'pr1' })),
    deleteProject: vi.fn(async () => {}),
    projectSummary: vi.fn(async () => ({ name: 'pr1', total_spent: 0, category_breakdown: [], currencies: [] })),
    listBudgets: vi.fn(async () => []),
    setBudget: vi.fn(async () => ({ name: 'b1' })),
    deleteBudget: vi.fn(async () => {}),
    budgetProgress: vi.fn(async () => ({ currency: 'INR', overall: null, categories: [] })),
    ...overrides,
  }
}

afterEach(() => vi.useRealTimers())

describe('useExpenses', () => {
  it('loads settings, list, and dashboard, then reports ready', async () => {
    const api = makeApi({
      listExpenses: vi.fn(async () => ({ expenses: [{ name: 'e1', description: 'Lunch' }], total: 1 })),
    })
    const x = useExpenses({ api })
    await x.load()

    expect(x.state.value).toBe('ready')
    expect(x.categories.value).toHaveLength(1)
    expect(x.expenses.value).toHaveLength(1)
    expect(x.dashboardData.value.currency).toBe('INR')
  })

  it('reports an error when setup fails', async () => {
    const api = makeApi({ setup: vi.fn(async () => { throw new Error('down') }) })
    const x = useExpenses({ api })
    await x.load()
    expect(x.state.value).toBe('error')
    expect(x.errorMessage.value).toBe('down')
  })

  it('opens a blank form using the default currency', () => {
    const x = useExpenses({ api: makeApi(), defaultCurrency: 'USD' })
    x.newExpense()
    expect(x.activeExpense.value.currency).toBe('USD')
    expect(x.activeExpense.value.expense_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('auto-fills the suggested category until the user picks one', async () => {
    vi.useFakeTimers()
    const api = makeApi()
    const x = useExpenses({ api })
    x.newExpense()
    x.activeExpense.value.merchant = 'Uber'
    x.requestSuggestion()
    await vi.runAllTimersAsync()

    expect(api.suggestCategory).toHaveBeenCalled()
    expect(x.suggestion.value.confidence).toBe('low')
    expect(x.activeExpense.value.category).toBe('c1')
  })

  it('does not override a category the user chose', async () => {
    vi.useFakeTimers()
    const x = useExpenses({ api: makeApi() })
    x.newExpense()
    x.activeExpense.value.merchant = 'Uber'
    x.activeExpense.value.category = 'chosen'
    x.markCategoryTouched()
    x.requestSuggestion()
    await vi.runAllTimersAsync()

    expect(x.activeExpense.value.category).toBe('chosen')
  })

  it('validates amount, description, and category before saving', async () => {
    const api = makeApi()
    const x = useExpenses({ api })
    x.newExpense()
    expect(await x.saveActive()).toBe(false)
    expect(x.saveError.value).toContain('amount')

    x.activeExpense.value.amount = 100
    expect(await x.saveActive()).toBe(false)
    expect(x.saveError.value).toContain('description')

    x.activeExpense.value.description = 'Lunch'
    expect(await x.saveActive()).toBe(false)
    expect(x.saveError.value).toContain('category')
    expect(api.saveExpense).not.toHaveBeenCalled()
  })

  it('saves a valid expense and reloads', async () => {
    const api = makeApi()
    const x = useExpenses({ api })
    await x.load()
    x.newExpense()
    Object.assign(x.activeExpense.value, { amount: 100, description: 'Lunch', category: 'c1' })

    expect(await x.saveActive()).toBe(true)
    expect(api.saveExpense).toHaveBeenCalledTimes(1)
    expect(x.activeExpense.value).toBeNull()
  })

  it('learns a rule on save when asked', async () => {
    const api = makeApi()
    const x = useExpenses({ api })
    x.newExpense()
    Object.assign(x.activeExpense.value, { amount: 5, description: 'Coffee', category: 'c1', merchant: 'Blue Tokai' })
    await x.saveActive({ learn: true })
    expect(api.learnRule).toHaveBeenCalledWith('Blue Tokai', 'c1')
  })

  it('keeps the form and input when a save fails', async () => {
    const api = makeApi({ saveExpense: vi.fn(async () => { throw new Error('nope') }) })
    const x = useExpenses({ api })
    x.newExpense()
    Object.assign(x.activeExpense.value, { amount: 5, description: 'Coffee', category: 'c1' })
    expect(await x.saveActive()).toBe(false)
    expect(x.activeExpense.value.description).toBe('Coffee')
    expect(x.saveError.value).toBe('nope')
  })

  it('appends the next page on loadMore', async () => {
    const calls = [
      { expenses: [{ name: 'e1' }], total: 2 },
      { expenses: [{ name: 'e2' }], total: 2 },
    ]
    let i = 0
    const api = makeApi({ listExpenses: vi.fn(async () => calls[i++]) })
    const x = useExpenses({ api })
    await x.loadExpenses()
    expect(x.hasMore.value).toBe(true)
    x.loadMore()
    await Promise.resolve()
    await Promise.resolve()
    expect(x.expenses.value.map((e) => e.name)).toEqual(['e1', 'e2'])
  })

  it('exports a CSV of the filtered results', async () => {
    const { downloadTextFile } = await import('@/utils/fileExport')
    const api = makeApi({
      listExpenses: vi.fn(async () => ({
        expenses: [{ expense_date: '2026-08-01', description: 'Lunch', amount: 250, currency: 'INR', category_name: 'Food' }],
        total: 1,
      })),
    })
    const x = useExpenses({ api })
    await x.exportCsv()
    expect(downloadTextFile).toHaveBeenCalled()
    expect(downloadTextFile.mock.calls[0][1]).toContain('Lunch')
  })
})

describe('useExpenses — trips, budgets, bulk', () => {
  it('loads projects and budget progress on load', async () => {
    const api = makeApi({
      listProjects: vi.fn(async () => [{ name: 'pr1', project_name: 'Goa' }]),
      budgetProgress: vi.fn(async () => ({ currency: 'INR', overall: { budget: 1000, spent: 400 }, categories: [] })),
    })
    const x = useExpenses({ api })
    await x.load()
    expect(x.projects.value).toHaveLength(1)
    expect(x.budgetData.value.overall.spent).toBe(400)
  })

  it('saves a project and reloads the list', async () => {
    const api = makeApi()
    const x = useExpenses({ api })
    await x.saveProject({ project_name: 'Goa' })
    expect(api.saveProject).toHaveBeenCalled()
    expect(api.listProjects).toHaveBeenCalled()
  })

  it('opens a project summary', async () => {
    const api = makeApi({ projectSummary: vi.fn(async () => ({ name: 'pr1', total_spent: 500, category_breakdown: [], currencies: [] })) })
    const x = useExpenses({ api })
    await x.openProjectSummary('pr1')
    expect(x.activeProjectSummary.value.total_spent).toBe(500)
    x.closeProjectSummary()
    expect(x.activeProjectSummary.value).toBeNull()
  })

  it('sets a budget through the api and reloads', async () => {
    const api = makeApi()
    const x = useExpenses({ api })
    await x.setBudget({ month: 8, year: 2026, budget_amount: 5000 })
    expect(api.setBudget).toHaveBeenCalled()
    expect(api.budgetProgress).toHaveBeenCalled()
  })

  it('tracks a bulk selection and applies changes', async () => {
    const api = makeApi()
    const x = useExpenses({ api })
    x.toggleSelected('e1')
    x.toggleSelected('e2')
    x.toggleSelected('e1') // toggle off
    expect(x.selectedCount.value).toBe(1)
    expect(x.isSelected('e2')).toBe(true)

    await x.bulkApply({ category: 'c1', addTag: 'work' })
    expect(api.bulkUpdate).toHaveBeenCalledWith(['e2'], { category: 'c1', addTag: 'work', project: null })
    expect(x.selectedCount.value).toBe(0)
  })

  it('bulk deletes the selection', async () => {
    const api = makeApi()
    const x = useExpenses({ api })
    x.toggleSelected('e1')
    await x.bulkRemove()
    expect(api.bulkDelete).toHaveBeenCalledWith(['e1'])
    expect(x.selectedCount.value).toBe(0)
  })
})

describe('helpers', () => {
  it('formatMoney renders a currency amount and tolerates junk', () => {
    expect(formatMoney(250, 'INR')).toContain('250')
    expect(formatMoney('', 'INR')).toBe('')
  })

  it('confidenceLabel maps known levels', () => {
    expect(confidenceLabel('high')).toBe('High confidence')
    expect(confidenceLabel('nope')).toBe('')
  })
})
