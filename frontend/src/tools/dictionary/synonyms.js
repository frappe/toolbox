// Every synonym an entry carries, gathered into one list for each part of speech.
//
// WordNet is built on synsets, so it records a synonym against a single sense. "Quiet" has
// thirteen senses, and five of them repeat a word another sense already offered. A visitor asking
// what else means quiet wants one list per part of speech, not thirteen answers with repeats.
//
// The per-sense lists stay where they are. They say which meaning a synonym belongs to, which is
// the question this one cannot answer.

export function groupSynonyms(senses, word = '') {
  const headword = normalize(word)
  const groups = new Map()

  for (const sense of senses ?? []) {
    const pos = sense?.pos || 'other'
    if (!groups.has(pos)) groups.set(pos, new Map())
    const words = groups.get(pos)

    for (const synonym of sense?.synonyms ?? []) {
      const key = normalize(synonym)
      // The importer excludes the headword today. A release that stopped doing so would otherwise
      // offer a visitor the word they just searched for as another word for itself.
      if (!key || key === headword || words.has(key)) continue
      words.set(key, String(synonym).trim())
    }
  }

  return [...groups.entries()]
    .filter(([, words]) => words.size)
    .map(([pos, words]) => ({ pos, words: [...words.values()] }))
}

export function countSynonyms(groups) {
  return groups.reduce((total, group) => total + group.words.length, 0)
}

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}
