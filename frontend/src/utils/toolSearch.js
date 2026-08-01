const FIELD_WEIGHTS = {
  name: 120,
  id: 90,
  searchKeywords: 80,
  description: 36,
  category: 24,
}

const MINIMUM_SCORE = 30

export function searchTools(query, tools) {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return [...tools]

  return tools
    .map((tool) => ({ tool, score: scoreTool(tool, normalizedQuery) }))
    .filter((result) => result.score >= MINIMUM_SCORE)
    .sort((left, right) => right.score - left.score || left.tool.name.localeCompare(right.tool.name))
    .map((result) => result.tool)
}

function scoreTool(tool, query) {
  const queryTokens = tokenize(query)
  const normalizedName = normalize(tool.name)
  let score = 0

  if (normalizedName === query) score += 500
  else if (normalizedName.startsWith(query)) score += 260
  else if (normalizedName.includes(query)) score += 150

  let matchedTokens = 0
  for (const queryToken of queryTokens) {
    const tokenScore = scoreToken(tool, queryToken)
    if (tokenScore > 0) matchedTokens += 1
    score += tokenScore
  }

  if (queryTokens.length > 1 && matchedTokens !== queryTokens.length) return 0
  return score
}

function scoreToken(tool, queryToken) {
  let best = 0

  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    const value = Array.isArray(tool[field]) ? tool[field].join(' ') : tool[field]
    const match = bestTokenMatch(queryToken, tokenize(normalize(value)))
    best = Math.max(best, match * weight)
  }

  return best
}

function bestTokenMatch(queryToken, valueTokens) {
  let best = 0

  for (const valueToken of valueTokens) {
    if (valueToken === queryToken) return 1
    if (valueToken.startsWith(queryToken)) best = Math.max(best, 0.78)
    else if (valueToken.includes(queryToken)) best = Math.max(best, 0.52)
    else if (isCloseMatch(queryToken, valueToken)) best = Math.max(best, 0.34)
  }

  return best
}

function isCloseMatch(queryToken, valueToken) {
  if (queryToken.length < 4 || Math.abs(queryToken.length - valueToken.length) > 2) return false
  const maxDistance = queryToken.length > 7 ? 2 : 1
  return levenshteinDistance(queryToken, valueToken) <= maxDistance
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      current[rightIndex] = Math.min(previous[rightIndex] + 1, current[rightIndex - 1] + 1, substitution)
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length]
}

function tokenize(value) {
  return value.split(/[^a-z0-9]+/).filter(Boolean)
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
