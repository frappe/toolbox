const names = {
  AUD: 'Australian dollar', BRL: 'Brazilian real', CAD: 'Canadian dollar', CHF: 'Swiss franc',
  CNY: 'Chinese yuan', CZK: 'Czech koruna', DKK: 'Danish krone', EUR: 'Euro',
  GBP: 'Pound sterling', HKD: 'Hong Kong dollar', HUF: 'Hungarian forint', IDR: 'Indonesian rupiah',
  ILS: 'Israeli new shekel', INR: 'Indian rupee', ISK: 'Icelandic krona', JPY: 'Japanese yen',
  KRW: 'South Korean won', MXN: 'Mexican peso', MYR: 'Malaysian ringgit', NOK: 'Norwegian krone',
  NZD: 'New Zealand dollar', PHP: 'Philippine peso', PLN: 'Polish zloty', RON: 'Romanian leu',
  SEK: 'Swedish krona', SGD: 'Singapore dollar', THB: 'Thai baht', TRY: 'Turkish lira',
  USD: 'US dollar', ZAR: 'South African rand',
}

export function createCurrencyList(rates) {
  if (!rates || typeof rates !== 'object' || Array.isArray(rates)) return []
  return Object.keys(rates)
    .filter((code) => Object.hasOwn(names, code))
    .sort()
    .map((code) => ({ code, name: names[code] }))
}

export function getCurrencyName(code) { return names[code] ?? code }

export function searchCurrencies(currencies, query) {
  const words = String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return currencies
  return currencies.filter(({ code, name }) => {
    const haystack = `${code} ${name}`.toLocaleLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}
