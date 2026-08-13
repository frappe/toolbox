// Every synonym or antonym an entry carries, gathered into one list for each part of speech.
//
// WordNet records both against a single sense. "Quiet" has thirteen senses, and five of them
// repeat a synonym another sense already offered; "increase" is recorded as the opposite of
// "decrease" six times over. A visitor asking what else means quiet, or what the opposite of
// increase is, wants one list per part of speech rather than one answer per sense.
//
// The per-sense synonym lists stay where they are. They say which meaning a word belongs to,
// which is the question this one cannot answer.

export function groupRelatedWords(senses, field, word = '') {
  const headword = normalize(word)
  const groups = new Map()

  for (const sense of senses ?? []) {
    const pos = sense?.pos || 'other'
    if (!groups.has(pos)) groups.set(pos, new Map())
    const words = groups.get(pos)

    for (const related of sense?.[field] ?? []) {
      const key = normalize(related)
      // The importer excludes the headword from its own synonyms today. A release that stopped
      // doing so would otherwise offer a visitor the word they just searched for as another word
      // for itself.
      if (!key || key === headword || words.has(key)) continue
      words.set(key, String(related).trim())
    }
  }

  return [...groups.entries()]
    .filter(([, words]) => words.size)
    .map(([pos, words]) => ({ pos, words: [...words.values()] }))
}

export function countRelatedWords(groups) {
  return groups.reduce((total, group) => total + group.words.length, 0)
}

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}
