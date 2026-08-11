export const currencyRateData = {
  schemaVersion: 1,
  baseCurrency: 'EUR',
  rateDate: '2026-07-31',
  providerCheckedAt: '2026-08-01T00:00:00Z',
  cacheStatus: 'live',
  rates: { EUR: 1, GBP: 0.85, INR: 100, SGD: 1.5, USD: 1.2 },
  source: {
    name: 'European Central Bank',
    url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',
    attribution: 'Source: ECB statistics.',
  },
  referenceRateNotice: 'ECB reference rates are for information only and are not transaction rates.',
}

// The chart reads a real dated series from the ECB statistics API through the server. A suite that
// leaves it unmocked fails whenever that service is slow, unreachable, or answering from a cold
// cache, and the failure lands on whichever spec happened to open the converter.
export const currencyHistoryData = {
  schemaVersion: 1,
  base: 'EUR',
  quote: 'USD',
  range: '1Y',
  points: [
    { date: '2025-08-11', value: 1.16 },
    { date: '2025-11-11', value: 1.18 },
    { date: '2026-02-11', value: 1.15 },
    { date: '2026-05-11', value: 1.17 },
    { date: '2026-08-10', value: 1.2 },
  ],
  observationCount: 5,
  source: {
    name: 'European Central Bank',
    url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',
    attribution: 'Source: ECB statistics.',
  },
  referenceRateNotice: 'ECB reference rates are for information only and are not transaction rates.',
}

export const currencyApiPattern = '**/api/method/toolbox.currency.get_reference_rates'
export const currencyHistoryApiPattern = '**/api/method/toolbox.currency_history.get_rate_history*'

export async function mockCurrencyRates(page, overrides = {}) {
  await page.route(currencyApiPattern, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: { ...currencyRateData, ...overrides } }) }),
  )
  await mockCurrencyHistory(page)
}

export async function mockCurrencyHistory(page, overrides = {}) {
  await page.route(currencyHistoryApiPattern, (route) => {
    const parameters = new URL(route.request().url()).searchParams
    const message = {
      ...currencyHistoryData,
      base: parameters.get('base') ?? currencyHistoryData.base,
      quote: parameters.get('quote') ?? currencyHistoryData.quote,
      range: parameters.get('range') ?? currencyHistoryData.range,
      ...overrides,
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message }) })
  })
}
