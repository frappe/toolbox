// The transliteration cases are reversible by hand: IAST writes one Latin letter, with its
// diacritic, for one Devanagari sign. So the expected strings were written from the Sanskrit, not
// read off the tool.
export const informationCases = [
  {
    toolId: 'dictionary',
    route: '/dictionary',
    cases: [
      {
        name: 'defines a word from the WordNet release',
        // The WordNet 3.1 gloss reads "good luck in making unexpected and fortunate discoveries".
        fill: [{ label: 'Search a word', value: 'serendipity' }, { click: 'Look up' }],
        expect: { contains: [/noun/i, /unexpected and fortunate/i] },
      },
      {
        name: 'offers what else means the same',
        fill: [{ label: 'Search a word', value: 'quiet' }, { click: 'Look up' }],
        expect: { contains: [/still|calm|hushed/i] },
      },
      {
        name: 'says so when a word is not in the release',
        fill: [
          { label: 'Search a word', value: 'zzzxqv' },
          { click: 'Look up' },
        ],
        expect: { contains: ['No exact match for', 'Check the spelling'] },
      },
    ],
  },
  {
    toolId: 'script-conversion',
    route: '/script-conversion',
    cases: [
      {
        name: 'writes Devanagari in IAST',
        // नमस्ते is na-ma-s-te. IAST keeps the inherent a and marks the vowel sign.
        fill: [
          { select: 'From', option: 'Devanagari' },
          { select: 'To', option: 'IAST' },
          { id: 'source-text', value: 'नमस्ते' },
        ],
        expect: { value: { label: 'Converted text', is: 'namaste' } },
      },
      {
        name: 'writes IAST back into Devanagari',
        fill: [
          { select: 'From', option: 'IAST' },
          { select: 'To', option: 'Devanagari' },
          { id: 'source-text', value: 'saṃskṛtam' },
        ],
        expect: { value: { label: 'Converted text', is: 'संस्कृतम्' } },
      },
    ],
  },
]
