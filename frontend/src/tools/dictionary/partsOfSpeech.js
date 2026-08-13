// One naming and one order for parts of speech, shared by the definitions, the synonyms and the
// antonyms. Three lists on one page that disagree about what to call a verb, or about which comes
// first, read as three unrelated pages.

const LABELS = { noun: 'Noun', verb: 'Verb', adjective: 'Adjective', adverb: 'Adverb' }
const ORDER = ['noun', 'verb', 'adjective', 'adverb']

export function partOfSpeechLabel(pos) {
  return LABELS[pos] ?? capitalize(pos)
}

// A part of speech WordNet does not use sorts last rather than throwing the order away.
export function byPartOfSpeech(left, right) {
  return rank(left.pos) - rank(right.pos)
}

function rank(pos) {
  const index = ORDER.indexOf(pos)
  return index === -1 ? ORDER.length : index
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}
