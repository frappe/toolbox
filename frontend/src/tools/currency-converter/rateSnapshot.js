export const CURRENCY_SNAPSHOT_KEY = 'toolbox:currency-reference-rates:v1'
const ECB_SOURCE_URL = 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html'

// `localStorage`, deliberately, and one of the three keys that outlive the session. The others are
// the theme and the sidebar shape. This one holds a table of public reference rates that names
// nobody, and it is the only thing that lets the converter convert on the first offline visit of a
// new session, which is the visit that matters. The rule it follows, from #206: cached public data
// may outlive the session, a record of the visitor may not.
export function loadRateSnapshot(storage = globalThis.localStorage) {
  try { return validateRateSnapshot(JSON.parse(storage?.getItem(CURRENCY_SNAPSHOT_KEY))) } catch { return null }
}

export function saveRateSnapshot(data, storage = globalThis.localStorage, now = () => Date.now()) {
  try {
    const snapshot = validateRateSnapshot({ version: 1, snapshotRefreshedAt: new Date(now()).toISOString(), data })
    if (!snapshot) return null
    storage?.setItem(CURRENCY_SNAPSHOT_KEY, JSON.stringify(snapshot))
    return snapshot
  } catch { return null }
}

export function validateRateSnapshot(value) {
  if (!isObject(value) || value.version !== 1 || !validIso(value.snapshotRefreshedAt) || !validRateData(value.data)) return null
  return value
}

export function validRateData(value) {
  if (!isObject(value) || value.schemaVersion !== 1 || value.baseCurrency !== 'EUR') return false
  if (!validDate(value.rateDate) || !validIso(value.providerCheckedAt)) return false
  if (!['live', 'cached', 'stale'].includes(value.cacheStatus) || !isObject(value.rates) || !isObject(value.source)) return false
  const entries = Object.entries(value.rates)
  if (entries.length < 5 || entries.length > 100 || !entries.some(([code, rate]) => code === 'EUR' && rate === 1)) return false
  if (!entries.every(([code, rate]) => /^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0 && rate <= 1e9)) return false
  return value.source.name === 'European Central Bank' && value.source.url === ECB_SOURCE_URL && value.source.attribution === 'Source: ECB statistics.'
}

function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function validIso(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) }
function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value) }
