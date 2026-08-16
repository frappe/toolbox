import { describe, expect, it, vi } from 'vitest'
import { ToolboxPreferencesStore } from '@/composables/useToolboxPreferences'
import { useCurrencyConverter } from './useCurrencyConverter'

const data = { schemaVersion: 1, baseCurrency: 'EUR', rateDate: '2026-07-31', providerCheckedAt: '2026-08-01T00:00:00Z', cacheStatus: 'live', rates: { EUR: 1, USD: 1.2, INR: 100, GBP: 0.8, SGD: 1.5 }, source: { name: 'European Central Bank', url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html', attribution: 'Source: ECB statistics.' }, referenceRateNotice: 'Reference rates only.' }

describe('currency converter workspace', () => {
  it('fetches rates once and converts every amount locally', async () => {
    const fetcher = vi.fn().mockResolvedValue(data)
    const converter = useCurrencyConverter({ preferences: new ToolboxPreferencesStore(null), storage: null, fetcher })
    await converter.loadRates()
    converter.amount.value = '200'
    expect(converter.convertedAmount.value).toBeCloseTo(2.4, 8)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('uses a saved snapshot when refresh fails', async () => {
    const stored = JSON.stringify({ version: 1, snapshotRefreshedAt: '2026-08-01T00:00:00Z', data })
    const storage = { getItem: () => stored, setItem() {} }
    const converter = useCurrencyConverter({ preferences: new ToolboxPreferencesStore(null), storage, fetcher: vi.fn().mockRejectedValue(new Error('offline')) })
    await converter.loadRates()
    expect(converter.loadState.value).toBe('offline')
    expect(converter.convertedAmount.value).not.toBeNull()
    expect(converter.errorMessage.value).toContain('saved offline snapshot')
  })

  it('swaps the two currencies', async () => {
    const converter = useCurrencyConverter({ preferences: new ToolboxPreferencesStore(null), storage: null, fetcher: vi.fn().mockResolvedValue(data) })
    await converter.loadRates()
    converter.swapCurrencies()
    expect([converter.sourceCurrency.value, converter.destinationCurrency.value]).toEqual(['USD', 'INR'])
  })

  // `usePair` outlived the saved-pair list it was written for: it is what the ?from=&to= deep
  // link uses, so it is still reachable from outside the tool.
  it('takes a pair from the query string', async () => {
    const converter = useCurrencyConverter({ preferences: new ToolboxPreferencesStore(null), storage: null, fetcher: vi.fn().mockResolvedValue(data) })
    await converter.loadRates()
    converter.usePair({ baseCurrency: 'USD', quoteCurrency: 'GBP' })
    expect([converter.sourceCurrency.value, converter.destinationCurrency.value]).toEqual(['USD', 'GBP'])
  })

  it('converts forward when the source amount is edited', async () => {
    const converter = useCurrencyConverter({ preferences: new ToolboxPreferencesStore(null), storage: null, fetcher: vi.fn().mockResolvedValue(data) })
    await converter.loadRates()
    converter.updateSourceAmount('200')
    // default INR -> USD: 200 INR = 2 EUR = 2.4 USD
    expect(converter.lastEdited.value).toBe('source')
    expect(converter.convertedAmount.value).toBeCloseTo(2.4, 8)
    expect(converter.destinationInput.value).toBe('2.4')
  })

  it('converts in reverse when the destination amount is edited', async () => {
    const converter = useCurrencyConverter({ preferences: new ToolboxPreferencesStore(null), storage: null, fetcher: vi.fn().mockResolvedValue(data) })
    await converter.loadRates()
    converter.updateDestinationAmount('6')
    // 6 USD = 5 EUR = 500 INR
    expect(converter.lastEdited.value).toBe('destination')
    expect(converter.sourceValue.value).toBeCloseTo(500, 6)
    expect(converter.sourceInput.value).toBe('500')
    expect(converter.convertedAmount.value).toBeCloseTo(6, 6)
  })
})
