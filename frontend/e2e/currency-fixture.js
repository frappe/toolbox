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

export const currencyApiPattern = '**/api/method/toolbox.currency.get_reference_rates'

export async function mockCurrencyRates(page, overrides = {}) {
  await page.route(currencyApiPattern, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: { ...currencyRateData, ...overrides } }) }),
  )
}
