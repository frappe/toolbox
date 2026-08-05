import { frappeRequest } from 'frappe-ui'

const EXPENSES = 'toolbox.expenses'
const SETTINGS = 'toolbox.expense_settings'
const FX = 'toolbox.expense_fx'

// Suggest a reference conversion rate (1 fromCurrency = rate toCurrency) from the ECB service.
// Returns { ok: true, rate, date, source } or { ok: false, error }.
export function suggestConversionRate(fromCurrency, toCurrency, request = frappeRequest) {
  return request({
    url: `${FX}.suggest_conversion_rate`,
    method: 'GET',
    params: { from_currency: fromCurrency, to_currency: toCurrency },
  })
}

// Seed defaults on first use and return the category + payment-method pickers.
export function setup(request = frappeRequest) {
  return request({ url: `${EXPENSES}.setup`, method: 'GET' })
}

// Deterministic category suggestion for a merchant/description. Never auto-applied server-side.
export function suggestCategory(merchant, description, request = frappeRequest) {
  return request({
    url: `${EXPENSES}.suggest_category`,
    method: 'GET',
    params: { merchant: merchant || '', description: description || '' },
  })
}

export function saveExpense(data, request = frappeRequest) {
  return request({
    url: `${EXPENSES}.save_expense`,
    method: 'POST',
    params: { payload: JSON.stringify(data) },
  })
}

export function deleteExpense(name, request = frappeRequest) {
  return request({ url: `${EXPENSES}.delete_expense`, method: 'POST', params: { name } })
}

// Attach a receipt (base64 image/PDF; a data: URL is accepted). Returns the updated expense.
export function attachReceipt(name, data, request = frappeRequest) {
  return request({ url: `${EXPENSES}.attach_receipt`, method: 'POST', params: { name, data } })
}

export function removeReceipt(name, request = frappeRequest) {
  return request({ url: `${EXPENSES}.remove_receipt`, method: 'POST', params: { name } })
}

// Filtered, paginated page of expenses plus the total match count.
export function listExpenses(filters = {}, limit = 50, start = 0, request = frappeRequest) {
  return request({
    url: `${EXPENSES}.list_expenses`,
    method: 'GET',
    params: { filters: JSON.stringify(filters), limit, start },
  })
}

// Turn a merchant + chosen category into a reusable exact-merchant rule.
export function learnRule(merchant, category, request = frappeRequest) {
  return request({
    url: `${EXPENSES}.learn_rule`,
    method: 'POST',
    params: { merchant, category },
  })
}

export function getDashboard({ month, year, currency } = {}, request = frappeRequest) {
  // Only send params that have a value: the server's int params reject empty strings (HTTP 417).
  const params = {}
  if (month) params.month = month
  if (year) params.year = year
  if (currency) params.currency = currency
  return request({ url: `${EXPENSES}.dashboard`, method: 'GET', params })
}

// --- settings: categories, payment methods, rules ---

export function listCategories(includeArchived = 0, request = frappeRequest) {
  return request({
    url: `${SETTINGS}.list_categories`,
    method: 'GET',
    params: { include_archived: includeArchived ? 1 : 0 },
  })
}

export function saveCategory(data, request = frappeRequest) {
  return request({
    url: `${SETTINGS}.save_category`,
    method: 'POST',
    params: { payload: JSON.stringify(data) },
  })
}

export function deleteCategory(name, request = frappeRequest) {
  return request({ url: `${SETTINGS}.delete_category`, method: 'POST', params: { name } })
}

export function listPaymentMethods(includeArchived = 0, request = frappeRequest) {
  return request({
    url: `${SETTINGS}.list_payment_methods`,
    method: 'GET',
    params: { include_archived: includeArchived ? 1 : 0 },
  })
}

export function savePaymentMethod(data, request = frappeRequest) {
  return request({
    url: `${SETTINGS}.save_payment_method`,
    method: 'POST',
    params: { payload: JSON.stringify(data) },
  })
}

export function deletePaymentMethod(name, request = frappeRequest) {
  return request({ url: `${SETTINGS}.delete_payment_method`, method: 'POST', params: { name } })
}

export function listRules(request = frappeRequest) {
  return request({ url: `${SETTINGS}.list_rules`, method: 'GET' })
}

export function saveRule(data, request = frappeRequest) {
  return request({
    url: `${SETTINGS}.save_rule`,
    method: 'POST',
    params: { payload: JSON.stringify(data) },
  })
}

export function deleteRule(name, request = frappeRequest) {
  return request({ url: `${SETTINGS}.delete_rule`, method: 'POST', params: { name } })
}

// --- bulk actions ---

export function bulkUpdate(names, { category, addTag, project } = {}, request = frappeRequest) {
  const params = { names: JSON.stringify(names) }
  if (category) params.category = category
  if (addTag) params.add_tag = addTag
  if (project) params.project_or_trip = project
  return request({ url: `${EXPENSES}.bulk_update`, method: 'POST', params })
}

export function bulkDelete(names, request = frappeRequest) {
  return request({ url: `${EXPENSES}.bulk_delete`, method: 'POST', params: { names: JSON.stringify(names) } })
}

// --- trips / projects ---

const PROJECTS = 'toolbox.expense_projects'

export function listProjects(includeArchived = 0, request = frappeRequest) {
  return request({
    url: `${PROJECTS}.list_projects`,
    method: 'GET',
    params: { include_archived: includeArchived ? 1 : 0 },
  })
}

export function saveProject(data, request = frappeRequest) {
  return request({
    url: `${PROJECTS}.save_project`,
    method: 'POST',
    params: { payload: JSON.stringify(data) },
  })
}

export function deleteProject(name, request = frappeRequest) {
  return request({ url: `${PROJECTS}.delete_project`, method: 'POST', params: { name } })
}

export function projectSummary(name, request = frappeRequest) {
  return request({ url: `${PROJECTS}.project_summary`, method: 'GET', params: { name } })
}

// --- budgets ---

const BUDGETS = 'toolbox.expense_budgets'

export function listBudgets({ month, year } = {}, request = frappeRequest) {
  const params = {}
  if (month) params.month = month
  if (year) params.year = year
  return request({ url: `${BUDGETS}.list_budgets`, method: 'GET', params })
}

export function setBudget(data, request = frappeRequest) {
  return request({
    url: `${BUDGETS}.set_budget`,
    method: 'POST',
    params: { payload: JSON.stringify(data) },
  })
}

export function deleteBudget(name, request = frappeRequest) {
  return request({ url: `${BUDGETS}.delete_budget`, method: 'POST', params: { name } })
}

export function budgetProgress({ month, year, currency } = {}, request = frappeRequest) {
  const params = {}
  if (month) params.month = month
  if (year) params.year = year
  if (currency) params.currency = currency
  return request({ url: `${BUDGETS}.budget_progress`, method: 'GET', params })
}
