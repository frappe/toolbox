// Client for the real ECB historical rate-series endpoint used by the rate chart.
// Every point is a genuine dated ECB reference rate — nothing is synthesized here.

export const RATE_CHART_RANGES = Object.freeze([
  { key: '1M', label: '1M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
  { key: '5Y', label: '5Y' },
  { key: 'MAX', label: 'Max' },
])

const RANGE_KEYS = new Set(RATE_CHART_RANGES.map((range) => range.key))

export function isRateChartRange(range) {
  return RANGE_KEYS.has(range)
}

export async function fetchRateHistory(base, quote, range, fetchImpl = globalThis.fetch) {
  const params = new URLSearchParams({ base, quote, range })
  const response = await fetchImpl(
    `/api/method/toolbox.currency_history.get_rate_history?${params.toString()}`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  )
  if (!response.ok) throw new Error('Rate history request failed')
  const payload = await response.json()
  return normalizeRateHistory(payload.message)
}

export function normalizeRateHistory(data) {
  if (!data || typeof data !== 'object') throw new Error('Malformed rate history')

  const points = Array.isArray(data.points)
    ? data.points
        .filter((point) => point && typeof point.date === 'string' && Number.isFinite(point.value))
        .map((point) => ({ date: point.date, value: Number(point.value) }))
    : []

  return {
    base: String(data.base ?? ''),
    quote: String(data.quote ?? ''),
    range: String(data.range ?? ''),
    points,
    source: data.source ?? null,
  }
}

// A plain date,rate CSV of the displayed series so users can take the real data with them.
export function buildRateCsv(series) {
  const header = `date,${series.base}_to_${series.quote}`
  const rows = series.points.map((point) => `${point.date},${point.value}`)
  return [header, ...rows].join('\n')
}
