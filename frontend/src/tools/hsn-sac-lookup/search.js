const SPACE_PATTERN = /\s+/g
const NON_WORD_PATTERN = /[^a-z0-9]+/g

export function createHsnSearchIndex(records) {
  const entries = records.map(prepareRecord)

  return Object.freeze({
    size: entries.length,
    search(query, limit = 50) {
      const normalizedQuery = normalizeText(query)
      if (!normalizedQuery) return []

      const digits = normalizedQuery.replace(/\s/g, '')
      const codeQuery = /^\d+$/.test(digits) ? digits : ''
      const queryWords = normalizedQuery.split(' ')
      const matches = []

      for (const entry of entries) {
        const score = rankEntry(entry, normalizedQuery, queryWords, codeQuery)
        if (score !== null) matches.push({ entry, score })
      }

      return matches
        .sort(compareMatches)
        .slice(0, limit)
        .map(({ entry }) => entry.record)
    },
  })
}

export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(NON_WORD_PATTERN, ' ')
    .replace(SPACE_PATTERN, ' ')
    .trim()
}

function prepareRecord(record) {
  const description = normalizeText(record.description)
  return {
    record: Object.freeze({ ...record }),
    code: String(record.code),
    description,
    words: description.split(' '),
  }
}

function rankEntry(entry, phrase, queryWords, codeQuery) {
  if (codeQuery) {
    if (entry.code === codeQuery) return 0
    if (entry.code.startsWith(codeQuery)) return 10 + entry.code.length - codeQuery.length
    return null
  }

  const phraseIndex = entry.description.indexOf(phrase)
  if (phraseIndex >= 0) return 30 + Math.min(phraseIndex, 999) / 1000

  if (queryWords.every((queryWord) => entry.words.includes(queryWord))) return 40
  if (queryWords.every((queryWord) => entry.words.some((word) => word.startsWith(queryWord)))) return 50

  const fuzzyDistance = totalFuzzyDistance(queryWords, entry.words)
  return fuzzyDistance === null ? null : 70 + fuzzyDistance
}

function totalFuzzyDistance(queryWords, words) {
  let total = 0
  for (const queryWord of queryWords) {
    if (queryWord.length < 4) return null
    const threshold = queryWord.length >= 8 ? 2 : 1
    let closest = threshold + 1
    for (const word of words) {
      if (Math.abs(word.length - queryWord.length) > threshold) continue
      closest = Math.min(closest, boundedLevenshtein(queryWord, word, threshold))
      if (closest === 0) break
    }
    if (closest > threshold) return null
    total += closest
  }
  return total
}

function boundedLevenshtein(left, right, limit) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    let rowMinimum = current[0]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      const distance = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + cost,
      )
      current.push(distance)
      rowMinimum = Math.min(rowMinimum, distance)
    }
    if (rowMinimum > limit) return limit + 1
    previous = current
  }
  return previous[right.length]
}

function compareMatches(left, right) {
  return (
    left.score - right.score ||
    left.entry.code.length - right.entry.code.length ||
    left.entry.code.localeCompare(right.entry.code) ||
    left.entry.description.localeCompare(right.entry.description)
  )
}
