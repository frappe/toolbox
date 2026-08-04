import { computed, ref } from 'vue'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { createCurrencyList } from './currencies'
import { convertCurrency, CurrencyConversionError } from './converter'
import { loadRateSnapshot, saveRateSnapshot, validRateData } from './rateSnapshot'

export function useCurrencyConverter({ preferences = useToolboxPreferences(), storage, fetcher = fetchReferenceRates, now } = {}) {
  const snapshot = loadRateSnapshot(storage)
  const rateData = ref(snapshot?.data ?? null)
  const snapshotRefreshedAt = ref(snapshot?.snapshotRefreshedAt ?? '')
  const loadState = ref(snapshot ? 'snapshot' : 'idle')
  const errorMessage = ref('')
  const copyStatus = ref('')
  const amount = ref('1000') // the source amount (kept for the stable public contract)
  const destinationAmount = ref('')
  const lastEdited = ref('source') // which box the user typed in; the other side is derived
  const currencies = computed(() => createCurrencyList(rateData.value?.rates))
  const sourceCurrency = ref(resolveDefaultCurrency(preferences.settings.defaultCurrency, currencies.value))
  const destinationCurrency = ref(sourceCurrency.value === 'USD' ? 'INR' : 'USD')
  const convertedAmount = computed(() => {
    if (!rateData.value) return null
    try {
      if (lastEdited.value === 'destination') {
        // Destination is authoritative; validate it by converting back to source.
        convertCurrency(destinationAmount.value, destinationCurrency.value, sourceCurrency.value, rateData.value.rates)
        return parseAmount(destinationAmount.value)
      }
      return convertCurrency(amount.value, sourceCurrency.value, destinationCurrency.value, rateData.value.rates)
    } catch { return null }
  })
  const sourceValue = computed(() => {
    if (!rateData.value) return null
    try {
      if (lastEdited.value === 'destination') {
        return convertCurrency(destinationAmount.value, destinationCurrency.value, sourceCurrency.value, rateData.value.rates)
      }
      convertCurrency(amount.value, sourceCurrency.value, destinationCurrency.value, rateData.value.rates)
      return parseAmount(amount.value)
    } catch { return null }
  })
  // The value shown in each box: the last-edited side shows the raw text; the other
  // shows the derived, converted value.
  const sourceInput = computed(() => (lastEdited.value === 'source' ? amount.value : plainAmount(sourceValue.value)))
  const destinationInput = computed(() => (lastEdited.value === 'destination' ? destinationAmount.value : plainAmount(convertedAmount.value)))
  const amountError = computed(() => {
    if (!rateData.value) return ''
    try {
      if (lastEdited.value === 'destination') {
        convertCurrency(destinationAmount.value, destinationCurrency.value, sourceCurrency.value, rateData.value.rates)
      } else {
        convertCurrency(amount.value, sourceCurrency.value, destinationCurrency.value, rateData.value.rates)
      }
      return ''
    } catch (error) { return error instanceof CurrencyConversionError ? error.message : 'The amount could not be converted.' }
  })
  const pairKey = computed(() => `${sourceCurrency.value}:${destinationCurrency.value}`)
  const isPairSaved = computed(() => preferences.savedCurrencyPairs.value.some((pair) => `${pair.baseCurrency}:${pair.quoteCurrency}` === pairKey.value))

  async function loadRates() {
    loadState.value = rateData.value ? 'refreshing' : 'loading'
    errorMessage.value = ''
    try {
      const data = await fetcher()
      if (!validRateData(data)) throw new Error('Invalid rate data')
      rateData.value = data
      const saved = saveRateSnapshot(data, storage, now)
      snapshotRefreshedAt.value = saved?.snapshotRefreshedAt ?? ''
      reconcileCurrencies()
      loadState.value = data.cacheStatus
    } catch {
      if (rateData.value) {
        loadState.value = 'offline'
        errorMessage.value = 'The latest rates could not be checked. Using the saved offline snapshot.'
      } else {
        loadState.value = 'error'
        errorMessage.value = 'Currency reference rates are unavailable. Connect to the internet and try again.'
      }
    }
  }

  function swapCurrencies() {
    ;[sourceCurrency.value, destinationCurrency.value] = [destinationCurrency.value, sourceCurrency.value]
    copyStatus.value = ''
  }

  function updateSourceAmount(value) {
    amount.value = value
    lastEdited.value = 'source'
    copyStatus.value = ''
  }

  function updateDestinationAmount(value) {
    destinationAmount.value = value
    lastEdited.value = 'destination'
    copyStatus.value = ''
  }

  function parseAmount(raw) {
    const text = String(raw ?? '').trim()
    if (text === '') return null
    const value = Number(text)
    return Number.isFinite(value) ? value : null
  }

  function plainAmount(value) {
    return value === null || value === undefined ? '' : String(Number(value.toFixed(6)))
  }

  function usePair(pair) {
    if (!currencies.value.some(({ code }) => code === pair.baseCurrency) || !currencies.value.some(({ code }) => code === pair.quoteCurrency)) return
    sourceCurrency.value = pair.baseCurrency
    destinationCurrency.value = pair.quoteCurrency
  }

  function toggleSavedPair() {
    const pairs = preferences.savedCurrencyPairs.value.filter(({ baseCurrency, quoteCurrency }) => `${baseCurrency}:${quoteCurrency}` !== pairKey.value)
    if (!isPairSaved.value) pairs.unshift({ baseCurrency: sourceCurrency.value, quoteCurrency: destinationCurrency.value })
    preferences.setSavedCurrencyPairs(pairs)
  }

  async function copyResult(clipboard = globalThis.navigator?.clipboard) {
    if (convertedAmount.value === null || sourceValue.value === null) return false
    try {
      await clipboard.writeText(`${formatAmount(sourceValue.value)} ${sourceCurrency.value} = ${formatAmount(convertedAmount.value)} ${destinationCurrency.value} (ECB reference rate, ${rateData.value.rateDate})`)
      copyStatus.value = 'Conversion copied.'
      return true
    } catch {
      copyStatus.value = 'Copy is unavailable in this browser.'
      return false
    }
  }

  function formatAmount(value) {
    const locale = preferences.settings.numberFormat === 'indian' ? 'en-IN' : 'en-US'
    return new Intl.NumberFormat(locale, { minimumFractionDigits: preferences.settings.decimalPrecision, maximumFractionDigits: preferences.settings.decimalPrecision }).format(value)
  }

  function reconcileCurrencies() {
    if (!currencies.value.some(({ code }) => code === sourceCurrency.value)) sourceCurrency.value = resolveDefaultCurrency(preferences.settings.defaultCurrency, currencies.value)
    if (!currencies.value.some(({ code }) => code === destinationCurrency.value) || destinationCurrency.value === sourceCurrency.value) destinationCurrency.value = sourceCurrency.value === 'USD' ? 'INR' : 'USD'
  }

  return { amount, destinationAmount, lastEdited, sourceInput, destinationInput, sourceValue, sourceCurrency, destinationCurrency, rateData, snapshotRefreshedAt, loadState, errorMessage, copyStatus, currencies, convertedAmount, amountError, isPairSaved, savedPairs: preferences.savedCurrencyPairs, loadRates, swapCurrencies, updateSourceAmount, updateDestinationAmount, usePair, toggleSavedPair, copyResult, formatAmount }
}

export async function fetchReferenceRates(fetchImpl = globalThis.fetch) {
  const response = await fetchImpl('/api/method/toolbox.currency.get_reference_rates', { method: 'GET', headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Rate request failed')
  const payload = await response.json()
  return payload.message
}

function resolveDefaultCurrency(preferred, currencies) {
  const codes = new Set(currencies.map(({ code }) => code))
  if (codes.has(preferred)) return preferred
  if (!currencies.length && ['EUR', 'GBP', 'INR', 'SGD', 'USD'].includes(preferred)) return preferred
  return codes.has('INR') || !currencies.length ? 'INR' : currencies[0].code
}
