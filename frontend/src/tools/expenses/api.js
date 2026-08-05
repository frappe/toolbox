import { frappeRequest } from 'frappe-ui'

const EXPENSES = 'toolbox.expenses'
const SETTINGS = 'toolbox.expense_settings'

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
