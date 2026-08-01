import { describe, expect, it } from 'vitest'
import { loadRateSnapshot, saveRateSnapshot, validateRateSnapshot } from './rateSnapshot'

const data = { schemaVersion: 1, baseCurrency: 'EUR', rateDate: '2026-07-31', providerCheckedAt: '2026-08-01T00:00:00Z', cacheStatus: 'live', rates: { EUR: 1, USD: 1.1, INR: 100, GBP: 0.8, SGD: 1.5 }, source: { name: 'European Central Bank', url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html', attribution: 'Source: ECB statistics.' } }

describe('offline rate snapshots', () => {
  it('round trips a valid versioned snapshot', () => {
    const values = new Map(), storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) }
    expect(saveRateSnapshot(data, storage, () => Date.UTC(2026, 7, 1))).toMatchObject({ version: 1, data })
    expect(loadRateSnapshot(storage)).toMatchObject({ data })
  })

  it('rejects malformed or unsafe rate data', () => {
    expect(validateRateSnapshot({ version: 2, snapshotRefreshedAt: '2026-08-01T00:00:00Z', data })).toBeNull()
    expect(validateRateSnapshot({ version: 1, snapshotRefreshedAt: 'bad', data })).toBeNull()
    expect(loadRateSnapshot({ getItem: () => '{bad' })).toBeNull()
    expect(saveRateSnapshot({ ...data, rates: { ...data.rates, USD: Infinity } }, { setItem() {} })).toBeNull()
    expect(saveRateSnapshot({ ...data, source: { ...data.source, url: 'javascript:alert(1)' } }, { setItem() {} })).toBeNull()
  })
})
