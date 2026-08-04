import { describe, expect, it, vi } from 'vitest'

import { buildRateCsv, fetchRateHistory, normalizeRateHistory } from './rateHistory'

const payload = {
  base: 'USD',
  quote: 'INR',
  range: '1M',
  points: [
    { date: '2026-07-30', value: 95.68 },
    { date: '2026-07-31', value: 95.38 },
  ],
  source: { name: 'European Central Bank', url: 'https://example.com' },
}

describe('normalizeRateHistory', () => {
  it('keeps only well-formed points', () => {
    const series = normalizeRateHistory({
      base: 'USD',
      quote: 'INR',
      range: '1Y',
      points: [
        { date: '2026-07-30', value: 95.68 },
        { date: '2026-07-31', value: 'oops' },
        { date: 42, value: 1 },
        { date: '2026-08-03', value: 95.33 },
      ],
    })
    expect(series.points).toEqual([
      { date: '2026-07-30', value: 95.68 },
      { date: '2026-08-03', value: 95.33 },
    ])
  })

  it('throws on a malformed payload', () => {
    expect(() => normalizeRateHistory(null)).toThrow()
  })
})

describe('buildRateCsv', () => {
  it('produces a date,rate CSV with a labelled header', () => {
    expect(buildRateCsv(normalizeRateHistory(payload))).toBe(
      'date,USD_to_INR\n2026-07-30,95.68\n2026-07-31,95.38',
    )
  })
})

describe('fetchRateHistory', () => {
  it('requests the endpoint and normalizes the response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: payload }),
    })
    const series = await fetchRateHistory('USD', 'INR', '1M', fetchImpl)

    expect(fetchImpl).toHaveBeenCalledOnce()
    const url = fetchImpl.mock.calls[0][0]
    expect(url).toContain('base=USD')
    expect(url).toContain('quote=INR')
    expect(url).toContain('range=1M')
    expect(series.points).toHaveLength(2)
  })

  it('throws when the request fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false })
    await expect(fetchRateHistory('USD', 'INR', '1M', fetchImpl)).rejects.toThrow()
  })
})
