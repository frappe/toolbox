import { getUnitsByCategory, units } from './registry'

export function searchUnits(query, options = {}) {
  if (typeof query !== 'string') {
    throw new TypeError('Unit search query must be a string.')
  }

  const candidates = selectCandidates(options.categoryId)
  const limit = validateLimit(options.limit)
  const rawQuery = query.trim()
  const normalizedQuery = normalizeSearchText(query)

  if (!normalizedQuery) {
    return candidates.slice(0, limit)
  }

  return candidates
    .map((unit, registryIndex) => ({
      unit,
      registryIndex,
      score: scoreUnit(unit, normalizedQuery, rawQuery),
    }))
    .filter((match) => Number.isFinite(match.score))
    .sort(compareMatches)
    .slice(0, limit)
    .map((match) => match.unit)
}

function selectCandidates(categoryId) {
  if (categoryId === undefined) {
    return units
  }

  if (typeof categoryId !== 'string') {
    throw new TypeError('Unit category ID must be a string.')
  }

  return getUnitsByCategory(categoryId)
}

function validateLimit(limit) {
  if (limit === undefined) {
    return Infinity
  }

  if (!Number.isInteger(limit) || limit < 0) {
    throw new RangeError('Unit search limit must be a non-negative integer.')
  }

  return limit
}

function scoreUnit(unit, query, rawQuery) {
  if (unit.symbol === rawQuery) {
    return -1
  }

  const fields = [unit.symbol, unit.name, unit.id, ...unit.aliases].map(normalizeSearchText)
  const exactIndex = fields.findIndex((field) => field === query)
  if (exactIndex >= 0) {
    return exactIndex
  }

  const prefixIndex = fields.findIndex((field) => field.startsWith(query))
  if (prefixIndex >= 0) {
    return 20 + prefixIndex
  }

  const words = fields.flatMap((field) => field.split(' '))
  if (words.some((word) => word.startsWith(query))) {
    return 50
  }

  const queryTokens = query.split(' ')
  const searchableText = fields.join(' ')
  if (queryTokens.every((token) => searchableText.includes(token))) {
    return 100 + searchableText.indexOf(queryTokens[0])
  }

  return Infinity
}

function compareMatches(left, right) {
  return left.score - right.score || left.registryIndex - right.registryIndex
}

function normalizeSearchText(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/°/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}
