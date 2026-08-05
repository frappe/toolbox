import { computed, reactive, ref } from 'vue'

import * as expensesApi from './api'
import { downloadJson, downloadTextFile } from '@/utils/fileExport'

export const SUGGEST_DEBOUNCE_MS = 400
const PAGE_SIZE = 50
const EXPORT_LIMIT = 200

// Owns the Expenses tool: dashboard, the filtered/paginated ledger, the quick-add form with
// live deterministic category suggestions, and settings (categories, payment methods, rules).
// The view stays presentational. Tests inject a fake `api` of the same shape.
export function useExpenses({ api = expensesApi, defaultCurrency = 'INR' } = {}) {
  const view = ref('list')
  const state = ref('loading')
  const errorMessage = ref('')

  const categories = ref([])
  const paymentMethods = ref([])
  const rules = ref([])

  const expenses = ref([])
  const total = ref(0)
  const listLoading = ref(false)
  const filters = reactive({
    search: '',
    category: '',
    payment_method: '',
    project_or_trip: '',
    currency: '',
    from_date: '',
    to_date: '',
    sort: 'date_desc',
  })

  const activeExpense = ref(null)
  const suggestion = ref(null)
  const saving = ref(false)
  const saveError = ref('')
  const dashboardData = ref(null)

  const projects = ref([])
  const activeProjectSummary = ref(null)
  const budgets = ref([])
  const budgetData = ref(null)
  const selectedIds = ref([])

  // Whether the user has hand-picked the category, so a later suggestion never overrides them.
  let categoryTouched = false
  let suggestTimer = null
  let listToken = 0

  const activeCategories = computed(() => categories.value.filter((c) => !c.is_archived))
  const hasMore = computed(() => expenses.value.length < total.value)
  const selectedCount = computed(() => selectedIds.value.length)
  const canLearnRule = computed(() => {
    const e = activeExpense.value
    return Boolean(e && e.merchant && e.category && suggestion.value && suggestion.value.category !== e.category)
  })

  async function load() {
    state.value = 'loading'
    errorMessage.value = ''
    try {
      const data = await api.setup()
      categories.value = data.categories || []
      paymentMethods.value = data.payment_methods || []
      await Promise.all([loadExpenses(), loadDashboard(), loadProjects(), loadBudgetProgress()])
      state.value = 'ready'
    } catch (error) {
      state.value = 'error'
      errorMessage.value = readError(error, 'Your expenses could not be loaded.')
    }
  }

  async function loadExpenses(reset = true) {
    const token = ++listToken
    listLoading.value = true
    const start = reset ? 0 : expenses.value.length
    try {
      const page = await api.listExpenses(cleanFilters(), PAGE_SIZE, start)
      if (token !== listToken) return
      expenses.value = reset ? page.expenses : [...expenses.value, ...page.expenses]
      total.value = page.total
    } catch (error) {
      if (token === listToken) saveError.value = readError(error, 'Expenses could not be loaded.')
    } finally {
      if (token === listToken) listLoading.value = false
    }
  }

  function loadMore() {
    if (hasMore.value && !listLoading.value) void loadExpenses(false)
  }

  // Search debounces; the structured filters apply immediately.
  function setSearch(value) {
    filters.search = value
    clearTimeout(suggestTimer)
    suggestTimer = setTimeout(() => void loadExpenses(), SUGGEST_DEBOUNCE_MS)
  }

  function applyFilters() {
    void loadExpenses()
  }

  function resetFilters() {
    Object.assign(filters, {
      search: '', category: '', payment_method: '', project_or_trip: '', currency: '',
      from_date: '', to_date: '', sort: 'date_desc',
    })
    void loadExpenses()
  }

  async function loadDashboard(params = {}) {
    try {
      dashboardData.value = await api.getDashboard(params)
    } catch {
      dashboardData.value = null
    }
  }

  // --- quick add / edit form ---

  function newExpense() {
    categoryTouched = false
    suggestion.value = null
    saveError.value = ''
    activeExpense.value = {
      name: null,
      expense_date: today(),
      amount: '',
      currency: defaultCurrency,
      description: '',
      merchant: '',
      category: '',
      payment_method: '',
      project_or_trip: '',
      account_label: '',
      reference_number: '',
      note: '',
      tags: [],
      base_currency: '',
      conversion_rate: '',
      conversion_source: '',
    }
  }

  function editExpense(row) {
    categoryTouched = true
    suggestion.value = null
    saveError.value = ''
    activeExpense.value = {
      name: row.name,
      expense_date: row.expense_date,
      amount: row.amount,
      currency: row.currency,
      description: row.description || '',
      merchant: row.merchant || '',
      category: row.category || '',
      payment_method: row.payment_method || '',
      project_or_trip: row.project_or_trip || '',
      account_label: row.account_label || '',
      reference_number: row.reference_number || '',
      note: row.note || '',
      tags: Array.isArray(row.tags) ? [...row.tags] : [],
      base_currency: row.base_currency || '',
      conversion_rate: row.conversion_rate || '',
      conversion_source: row.conversion_source || '',
    }
  }

  function closeForm() {
    activeExpense.value = null
    suggestion.value = null
  }

  function markCategoryTouched() {
    categoryTouched = true
  }

  // Debounced deterministic suggestion; auto-fills the category only until the user picks one.
  function requestSuggestion() {
    clearTimeout(suggestTimer)
    const e = activeExpense.value
    if (!e || (!e.merchant && !e.description)) return
    suggestTimer = setTimeout(async () => {
      try {
        const result = await api.suggestCategory(e.merchant, e.description)
        suggestion.value = result
        if (!categoryTouched && result.category) e.category = result.category
      } catch {
        // Suggestions are advisory; a failure just means the user picks manually.
      }
    }, SUGGEST_DEBOUNCE_MS)
  }

  async function saveActive({ learn = false } = {}) {
    const e = activeExpense.value
    if (!e) return false
    if (!e.amount || Number(e.amount) <= 0) {
      saveError.value = 'Enter an amount greater than zero.'
      return false
    }
    if (!e.description.trim()) {
      saveError.value = 'Add a short description.'
      return false
    }
    if (!e.category) {
      saveError.value = 'Choose a category.'
      return false
    }
    saving.value = true
    saveError.value = ''
    try {
      if (learn && e.merchant) await api.learnRule(e.merchant, e.category)
      await api.saveExpense(buildPayload(e))
      activeExpense.value = null
      suggestion.value = null
      await Promise.all([loadExpenses(), loadDashboard()])
      return true
    } catch (error) {
      saveError.value = readError(error, 'Your expense could not be saved. It is still here — try again.')
      return false
    } finally {
      saving.value = false
    }
  }

  async function removeExpense(name) {
    if (!name) return
    try {
      await api.deleteExpense(name)
      if (activeExpense.value?.name === name) activeExpense.value = null
      await Promise.all([loadExpenses(), loadDashboard()])
    } catch (error) {
      saveError.value = readError(error, 'This expense could not be deleted.')
    }
  }

  // --- settings ---

  async function loadRules() {
    try {
      rules.value = await api.listRules()
    } catch (error) {
      saveError.value = readError(error, 'Rules could not be loaded.')
    }
  }

  async function saveCategory(data) {
    await api.saveCategory(data)
    categories.value = await api.listCategories()
  }

  async function removeCategory(name) {
    await api.deleteCategory(name)
    categories.value = await api.listCategories()
  }

  async function savePaymentMethod(data) {
    await api.savePaymentMethod(data)
    paymentMethods.value = await api.listPaymentMethods()
  }

  async function removePaymentMethod(name) {
    await api.deletePaymentMethod(name)
    paymentMethods.value = await api.listPaymentMethods()
  }

  async function saveRule(data) {
    await api.saveRule(data)
    await loadRules()
  }

  async function removeRule(name) {
    await api.deleteRule(name)
    await loadRules()
  }

  // --- trips / projects ---

  async function loadProjects() {
    try {
      projects.value = await api.listProjects()
    } catch {
      projects.value = []
    }
  }

  async function saveProject(data) {
    await api.saveProject(data)
    await loadProjects()
  }

  async function removeProject(name) {
    await api.deleteProject(name)
    if (activeProjectSummary.value?.name === name) activeProjectSummary.value = null
    await loadProjects()
  }

  async function openProjectSummary(name) {
    try {
      activeProjectSummary.value = await api.projectSummary(name)
    } catch (error) {
      saveError.value = readError(error, 'This trip could not be opened.')
    }
  }

  function closeProjectSummary() {
    activeProjectSummary.value = null
  }

  // --- budgets ---

  async function loadBudgets(params = {}) {
    try {
      budgets.value = await api.listBudgets(params)
    } catch {
      budgets.value = []
    }
  }

  async function loadBudgetProgress(params = {}) {
    try {
      budgetData.value = await api.budgetProgress(params)
    } catch {
      budgetData.value = null
    }
  }

  async function setBudget(data) {
    await api.setBudget(data)
    await Promise.all([loadBudgets({ month: data.month, year: data.year }), loadBudgetProgress()])
  }

  async function removeBudget(name) {
    await api.deleteBudget(name)
    await Promise.all([loadBudgets(), loadBudgetProgress()])
  }

  // --- bulk selection ---

  function toggleSelected(name) {
    const index = selectedIds.value.indexOf(name)
    if (index === -1) selectedIds.value.push(name)
    else selectedIds.value.splice(index, 1)
  }

  function isSelected(name) {
    return selectedIds.value.includes(name)
  }

  function clearSelection() {
    selectedIds.value = []
  }

  async function bulkApply({ category = null, addTag = null, project = null } = {}) {
    if (!selectedIds.value.length) return
    await api.bulkUpdate(selectedIds.value, { category, addTag, project })
    clearSelection()
    await Promise.all([loadExpenses(), loadDashboard(), loadBudgetProgress()])
  }

  async function bulkRemove() {
    if (!selectedIds.value.length) return
    await api.bulkDelete(selectedIds.value)
    clearSelection()
    await Promise.all([loadExpenses(), loadDashboard(), loadBudgetProgress()])
  }

  // --- export (the loaded, filtered results) ---

  async function exportRows() {
    const page = await api.listExpenses(cleanFilters(), EXPORT_LIMIT, 0)
    return page.expenses || []
  }

  async function exportCsv() {
    const rows = await exportRows()
    const header = [
      'Date', 'Description', 'Merchant', 'Category', 'Amount', 'Currency', 'Base amount',
      'Base currency', 'Payment method', 'Account label', 'Tags', 'Note', 'Reference number',
    ]
    const body = rows.map((r) => [
      r.expense_date || '', r.description || '', r.merchant || '', r.category_name || '',
      r.amount ?? '', r.currency || '', r.base_amount ?? '', r.base_currency || '',
      r.payment_method_name || '', r.account_label || '', (r.tags || []).join(' '),
      r.note || '', r.reference_number || '',
    ])
    const csv = [header, ...body].map((row) => row.map(csvCell).join(',')).join('\r\n')
    return downloadTextFile('expenses.csv', `${csv}\r\n`, 'text/csv')
  }

  async function exportJson() {
    return downloadJson('expenses.json', await exportRows())
  }

  function buildPayload(e) {
    return {
      name: e.name || undefined,
      expense_date: e.expense_date,
      amount: Number(e.amount),
      currency: e.currency,
      description: e.description,
      merchant: e.merchant || '',
      category: e.category,
      payment_method: e.payment_method || '',
      project_or_trip: e.project_or_trip || '',
      account_label: e.account_label || '',
      reference_number: e.reference_number || '',
      note: e.note || '',
      tags: e.tags || [],
      categorisation_rule: suggestion.value?.rule_name || '',
      base_currency: e.base_currency || '',
      conversion_rate: e.conversion_rate ? Number(e.conversion_rate) : '',
      conversion_source: e.base_currency && e.conversion_rate ? e.conversion_source || 'manual' : '',
    }
  }

  function cleanFilters() {
    const out = {}
    for (const [key, value] of Object.entries(filters)) {
      if (value) out[key] = value
    }
    return out
  }

  return {
    view,
    state,
    errorMessage,
    categories,
    activeCategories,
    paymentMethods,
    rules,
    expenses,
    total,
    hasMore,
    listLoading,
    filters,
    activeExpense,
    suggestion,
    canLearnRule,
    saving,
    saveError,
    dashboardData,
    projects,
    activeProjectSummary,
    budgets,
    budgetData,
    selectedIds,
    selectedCount,
    load,
    loadExpenses,
    loadMore,
    setSearch,
    applyFilters,
    resetFilters,
    loadDashboard,
    newExpense,
    editExpense,
    closeForm,
    markCategoryTouched,
    requestSuggestion,
    saveActive,
    removeExpense,
    loadRules,
    saveCategory,
    removeCategory,
    savePaymentMethod,
    removePaymentMethod,
    saveRule,
    removeRule,
    loadProjects,
    saveProject,
    removeProject,
    openProjectSummary,
    closeProjectSummary,
    loadBudgets,
    loadBudgetProgress,
    setBudget,
    removeBudget,
    toggleSelected,
    isSelected,
    clearSelection,
    bulkApply,
    bulkRemove,
    exportCsv,
    exportJson,
  }
}

export function formatMoney(amount, currency) {
  if (amount === null || amount === undefined || amount === '') return ''
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'INR' }).format(Number(amount))
  } catch {
    return `${amount} ${currency || ''}`.trim()
  }
}

export function confidenceLabel(confidence) {
  return { high: 'High confidence', medium: 'Likely', low: 'Best guess' }[confidence] || ''
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function readError(error, fallback) {
  if (Array.isArray(error?.messages) && error.messages.length) return error.messages[0]
  return error?.message || fallback
}
