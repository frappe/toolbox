// Preferences live in the visitor's own sessionStorage, so seeding one is a storage write rather
// than an API call. Each browser context gets its own storage, which is why the suite can run in
// parallel again.
//
// Call these after a first `page.goto` (the write needs the page to be on the origin) and before
// the navigation the test actually exercises: the store reads storage once, at module load.

export const PREFERENCES_STORAGE_KEY = 'toolbox:preferences:v1'

const EMPTY = {
  version: 1,
  hiddenToolIds: [],
  recentToolIds: [],
  savedCurrencyPairs: [],
  savedWorldClockLocations: [],
  settings: {},
}

export async function resetToolboxPreferences(page) {
  await page.evaluate((key) => globalThis.sessionStorage.removeItem(key), PREFERENCES_STORAGE_KEY)
}

export async function seedToolboxPreferences(page, overrides = {}) {
  await page.evaluate(
    ({ key, value }) => globalThis.sessionStorage.setItem(key, JSON.stringify(value)),
    { key: PREFERENCES_STORAGE_KEY, value: { ...EMPTY, ...overrides } },
  )
}
