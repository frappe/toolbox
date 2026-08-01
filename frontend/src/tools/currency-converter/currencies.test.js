import { expect, it } from 'vitest'
import { createCurrencyList, searchCurrencies } from './currencies'

it('lists only named provider currencies and searches name or code', () => {
  const currencies = createCurrencyList({ EUR: 1, USD: 1.2, INR: 100, XXX: 3 })
  expect(currencies.map(({ code }) => code)).toEqual(['EUR', 'INR', 'USD'])
  expect(searchCurrencies(currencies, 'indian ru')).toEqual([{ code: 'INR', name: 'Indian rupee' }])
  expect(searchCurrencies(currencies, 'usd')[0].name).toBe('US dollar')
})
