// What every tool is built from, in the visitor's terms.
//
// The facts that change — the version in use, the day it was published, how many rows it holds —
// come from the server. What a dataset is, and which tools stand on it, is written here, because it
// is copy rather than data.

export const DATASET_NOTES = {
  PIN: {
    name: 'Indian post offices',
    tools: ['PIN Code Search'],
    note: 'Every post office in India with its PIN code, district and state, and coordinates where the source has them.',
  },
  IFSC: {
    name: 'Indian bank branches',
    tools: ['IFSC Code Search'],
    note: 'Every bank branch with an IFSC, its address and its city. A derivative of RBI and NPCI publications rather than a first-party download.',
  },
  HSN: {
    name: 'HSN and SAC codes',
    tools: ['HSN & SAC Lookup'],
    note: 'The CBIC classification of goods and services. It names what a code covers. It states no tax rate, because a rate is set by notification and changes.',
  },
  Dictionary: {
    name: 'English dictionary',
    tools: ['Dictionary'],
    note: 'WordNet, the lexical database built at Princeton University. It carries senses, examples and the synonyms of each sense.',
  },
}

// A live call rather than a stored release. Refresh describes what the server does, not a promise
// about the provider.
export const LIVE_SOURCES = [
  {
    id: 'ecb',
    name: 'European Central Bank',
    url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',
    license: 'Free to use with attribution',
    tools: ['Currency Converter'],
    note: 'The euro foreign exchange reference rates, published each working day. Every other pair is derived from them. They are reference rates, not the rate a bank would give you.',
    refresh: 'Checked every 6 hours, and kept for up to 30 days so a rate is still shown if the provider cannot be reached.',
  },
]

// Everything else. Naming what needs no source at all is the point of the page.
export const LOCAL_TOOLS = {
  note: 'Every other tool runs entirely in your browser and asks the server for nothing. A calculator, a converter, a timer and both audio tools work with no internet connection once the page has loaded.',
}
