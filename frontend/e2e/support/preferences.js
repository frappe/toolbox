import { expect } from '@playwright/test'

// Toolbox is authenticated-only and preferences live in one per-user server record, so specs
// share the Administrator account. Left unchecked, a test that favourites a tool or saves a
// currency pair leaks that state into later tests and re-runs. These helpers reset or seed
// that record through the same whitelisted method the app uses, keeping specs idempotent.

const PREFERENCE_METHOD =
  '/api/method/toolbox.toolbox.doctype.toolbox_user_preference.toolbox_user_preference.update_preferences'

// Applies a semantic operation batch to the signed-in user's preferences. Runs inside the page
// so it reuses the session cookie and the boot CSRF token; the page must already be on a
// Toolbox route (so window.csrf_token exists).
async function applyPreferenceOperations(page, operations) {
  const result = await page.evaluate(
    async ([url, ops]) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': window.csrf_token ?? '' },
        body: JSON.stringify({ payload: { version: 1, operations: ops } }),
      })
      return { ok: response.ok, status: response.status }
    },
    [PREFERENCE_METHOD, operations],
  )
  expect(result.ok, `preference update failed (HTTP ${result.status})`).toBe(true)
}

// Resets preferences to a clean baseline: no recents, default settings, and empty saved lists.
// Call from a beforeEach (after navigating to any Toolbox route) so each test starts from the same
// state regardless of order or prior runs.
export async function resetToolboxPreferences(page) {
  await applyPreferenceOperations(page, [
    { type: 'clearRecent' },
    { type: 'resetSettings' },
    { type: 'replaceSavedItems', field: 'savedCurrencyPairs', value: [] },
    { type: 'replaceSavedItems', field: 'savedWeatherLocations', value: [] },
    { type: 'replaceSavedItems', field: 'savedWorldClockLocations', value: [] },
  ])
}

// Seeds specific saved items for tests that read persisted state.
export async function seedToolboxPreferences(
  page,
  { savedCurrencyPairs, savedWorldClockLocations } = {},
) {
  const operations = []
  if (savedCurrencyPairs) {
    operations.push({ type: 'replaceSavedItems', field: 'savedCurrencyPairs', value: savedCurrencyPairs })
  }
  if (savedWorldClockLocations) {
    operations.push({ type: 'replaceSavedItems', field: 'savedWorldClockLocations', value: savedWorldClockLocations })
  }
  if (operations.length) await applyPreferenceOperations(page, operations)
}
