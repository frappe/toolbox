import { expect, test } from './fixtures'

// The backend tests call these functions in process. This file calls them over HTTP, as a visitor's
// browser does, which is the only way to exercise the whitelist, the rate-limit decorator, the
// read-only guard and the JSON envelope that Frappe wraps around a return value.
//
// It also asks the datasets what they hold. The expected rows come from the published sources —
// the Department of Posts list, the RBI IFSC reference, the CBIC classification, WordNet 3.1 — so
// an import that silently truncated or shifted a column fails here.
const api = (method) => `/api/method/toolbox.${method}`

async function call(request, method, parameters = {}) {
  const query = new URLSearchParams(parameters).toString()
  const response = await request.get(`${api(method)}${query ? `?${query}` : ''}`)
  return { status: response.status(), body: await response.json().catch(() => null) }
}

test('@smoke every dataset reports an active release', async ({ request }) => {
  for (const method of [
    'india_business.get_dataset_status',
    'hsn.get_dataset_status',
    'dictionary.get_dataset_status',
  ]) {
    const { status, body } = await call(request, method)
    expect(status, method).toBe(200)
    expect(body.message, method).toBeTruthy()
  }
})

test('@smoke the PIN release answers for a known code', async ({ request }) => {
  const { status, body } = await call(request, 'india_business.search_pin', { query: '110001' })

  expect(status).toBe(200)
  expect(body.message.results.length).toBeGreaterThan(0)
  expect(body.message.results[0].pin_code).toBe('110001')
  expect(JSON.stringify(body.message.results)).toMatch(/New Delhi/i)
})

test('@smoke the IFSC release answers for a known code', async ({ request }) => {
  const { status, body } = await call(request, 'india_business.search_ifsc', { query: 'SBIN0000001' })

  expect(status).toBe(200)
  expect(body.message.results.length).toBeGreaterThan(0)
  expect(body.message.results[0].ifsc_code).toBe('SBIN0000001')
  expect(body.message.results[0].bank_name).toMatch(/State Bank of India/i)
})

test('@smoke the HSN release answers for a known code', async ({ request }) => {
  const { status, body } = await call(request, 'hsn.search_hsn', { query: '0101' })

  expect(status).toBe(200)
  expect(body.message.results.length).toBeGreaterThan(0)
  expect(body.message.results[0].code).toBe('0101')
  expect(body.message.results[0].description).toMatch(/horses/i)
})

test('@smoke the dictionary release answers for a known word', async ({ request }) => {
  const { status, body } = await call(request, 'dictionary.lookup', { word: 'serendipity' })

  expect(status).toBe(200)
  expect(body.message.senses.length).toBeGreaterThan(0)
  expect(body.message.senses[0].definition).toMatch(/unexpected and fortunate/i)
})

test('a lookup that matches nothing answers with an empty result, not an error', async ({
  request,
}) => {
  const { status, body } = await call(request, 'india_business.search_pin', { query: '000000' })

  expect(status).toBe(200)
  expect(body.message.results).toEqual([])
})

test('every result set is bounded', async ({ request }) => {
  // A single letter matches a large part of the release. The endpoint caps what it returns, which
  // is what keeps one request from reading a whole table into memory.
  const { status, body } = await call(request, 'dictionary.suggest', { query: 'a' })

  expect(status).toBe(200)
  expect(body.message.suggestions.length).toBeLessThanOrEqual(20)
})

test('an over-large limit is clamped rather than honoured', async ({ request }) => {
  const { status, body } = await call(request, 'hsn.search_hsn', { query: '99', limit: '100000' })

  expect(status).toBe(200)
  expect(body.message.results.length).toBeLessThanOrEqual(100)
})

test('the data sources page is served from the same releases the tools read', async ({ request }) => {
  const { status, body } = await call(request, 'data_sources.get_data_sources')

  expect(status).toBe(200)
  const named = JSON.stringify(body.message)
  for (const source of ['PIN', 'IFSC', 'HSN', 'WordNet']) {
    expect(named, `${source} is missing from the data sources`).toMatch(new RegExp(source, 'i'))
  }
})
