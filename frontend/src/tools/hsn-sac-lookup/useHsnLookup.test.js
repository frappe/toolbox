import { describe, expect, it, vi } from 'vitest'

import { useHsnLookup } from '@/tools/hsn-sac-lookup/useHsnLookup'

function setup(overrides = {}) {
  const statusFetcher = overrides.statusFetcher ?? vi.fn().mockResolvedValue({ hsn: null })
  const searcher = overrides.searcher ?? vi.fn().mockResolvedValue({ results: [] })
  return { hsn: useHsnLookup({ statusFetcher, searcher }), statusFetcher, searcher }
}

describe('useHsnLookup', () => {
  it('exposes source metadata once status loads', async () => {
    const { hsn } = setup({
      statusFetcher: vi.fn().mockResolvedValue({
        hsn: { sourceUpdatedAt: '2024-06-25', recordCount: 5, source: { name: 'CBIC' } },
      }),
    })
    await hsn.loadStatus()

    expect(hsn.available.value).toBe(true)
    expect(hsn.sourceUpdatedAt.value).toBe('2024-06-25')
    expect(hsn.recordCount.value).toBe(5)
  })

  it('ignores queries shorter than two characters', async () => {
    const { hsn, searcher } = setup()
    hsn.query.value = 'a'
    await hsn.submit()

    expect(searcher).not.toHaveBeenCalled()
  })

  it('reports a friendly error when the search fails', async () => {
    const { hsn } = setup({ searcher: vi.fn().mockRejectedValue(new Error('boom')) })
    hsn.query.value = '8517'
    await hsn.submit()

    expect(hsn.errorMessage.value).toContain('unavailable')
    expect(hsn.results.value).toEqual([])
  })
})
