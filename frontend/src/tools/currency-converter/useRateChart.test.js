import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useRateChart } from './useRateChart'

function series(range, points = 3) {
  return {
    base: 'USD',
    quote: 'INR',
    range,
    points: Array.from({ length: points }, (_, index) => ({
      date: `2026-07-${10 + index}`,
      value: 95 + index,
    })),
    source: { url: 'https://example.com' },
  }
}

describe('useRateChart', () => {
  it('loads a series for the current pair and range', async () => {
    const fetcher = vi.fn((base, quote, range) => Promise.resolve(series(range)))
    const chart = useRateChart({ base: ref('USD'), quote: ref('INR'), fetcher })

    await chart.load()
    expect(chart.state.value).toBe('ready')
    expect(chart.series.value.points).toHaveLength(3)
    expect(fetcher).toHaveBeenCalledWith('USD', 'INR', '1Y')
  })

  it('switches range and caches results per pair+range', async () => {
    const fetcher = vi.fn((base, quote, range) => Promise.resolve(series(range)))
    const chart = useRateChart({ base: ref('USD'), quote: ref('INR'), fetcher })
    await chart.load()

    chart.setRange('5Y')
    await Promise.resolve()
    await Promise.resolve()
    expect(chart.range.value).toBe('5Y')
    expect(fetcher).toHaveBeenCalledWith('USD', 'INR', '5Y')

    // Returning to the cached range does not re-fetch.
    fetcher.mockClear()
    chart.setRange('1Y')
    await Promise.resolve()
    expect(fetcher).not.toHaveBeenCalled()
    expect(chart.state.value).toBe('ready')
  })

  it('marks a same-currency pair as unsupported without fetching', async () => {
    const fetcher = vi.fn()
    const chart = useRateChart({ base: ref('USD'), quote: ref('USD'), fetcher })
    await chart.load()

    expect(chart.state.value).toBe('unsupported')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('reports an error state when the fetch fails', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'))
    const chart = useRateChart({ base: ref('USD'), quote: ref('INR'), fetcher })
    await chart.load()

    expect(chart.state.value).toBe('error')
    expect(chart.errorMessage.value).toContain('unavailable')
  })

  it('flags a thin series as empty', async () => {
    const fetcher = vi.fn(() => Promise.resolve(series('1M', 1)))
    const chart = useRateChart({ base: ref('USD'), quote: ref('INR'), fetcher })
    await chart.load()

    expect(chart.state.value).toBe('empty')
  })

  it('reloads when the currency pair changes', async () => {
    const fetcher = vi.fn((base, quote, range) => Promise.resolve(series(range)))
    const quote = ref('INR')
    const chart = useRateChart({ base: ref('USD'), quote, fetcher })
    await chart.load()
    fetcher.mockClear()

    quote.value = 'GBP'
    await Promise.resolve()
    await Promise.resolve()
    expect(fetcher).toHaveBeenCalledWith('USD', 'GBP', '1Y')
  })
})
