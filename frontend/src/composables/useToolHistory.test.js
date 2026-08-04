import { describe, expect, it } from 'vitest'

import {
  MAX_TOOL_HISTORY_ENTRIES,
  toolHistoryStorageKey,
  useToolHistory,
} from './useToolHistory'

describe('useToolHistory', () => {
  it('persists label, value, timestamp, and payload under the tool key', () => {
    let tick = 1_000
    const history = useToolHistory('currency-converter', { now: () => (tick += 1) })
    const entry = history.add({
      label: '1,000 USD → INR',
      value: '83,120.00 INR',
      payload: { amount: 1000, source: 'USD', destination: 'INR' },
    })

    const stored = JSON.parse(
      globalThis.localStorage.getItem(toolHistoryStorageKey('currency-converter')),
    )
    expect(stored).toEqual([entry])
    expect(entry).toMatchObject({
      id: expect.any(String),
      label: '1,000 USD → INR',
      value: '83,120.00 INR',
      timestamp: expect.any(Number),
      payload: { amount: 1000, source: 'USD', destination: 'INR' },
    })
  })

  it('ignores blank entries and immediate duplicates', () => {
    const history = useToolHistory('unit-converter')

    expect(history.add({ label: '', value: '5' })).toBeNull()
    expect(history.add({ label: '5 km', value: '' })).toBeNull()

    const first = history.add({ label: '5 km → mi', value: '3.106 mi' })
    const duplicate = history.add({ label: '5 km → mi', value: '3.106 mi' })
    expect(duplicate).toStrictEqual(first)
    expect(history.entries.value).toHaveLength(1)

    history.add({ label: '10 km → mi', value: '6.213 mi' })
    expect(history.entries.value).toHaveLength(2)
    expect(history.entries.value[0].label).toBe('10 km → mi')
  })

  it('keeps the newest bounded set of results', () => {
    let tick = 0
    const history = useToolHistory('gst-calculator', { now: () => (tick += 1) })

    for (let index = 0; index < MAX_TOOL_HISTORY_ENTRIES + 5; index += 1) {
      history.add({ label: `entry ${index}`, value: `₹${index}` })
    }

    expect(history.entries.value).toHaveLength(MAX_TOOL_HISTORY_ENTRIES)
    expect(history.entries.value[0].label).toBe('entry 54')
    expect(history.entries.value.at(-1).label).toBe('entry 5')
  })

  it('removes and clears entries', () => {
    let tick = 0
    const history = useToolHistory('financial-calculators', { now: () => (tick += 1) })
    const first = history.add({ label: 'SIP', value: '₹1,00,000' })
    history.add({ label: 'EMI', value: '₹2,000' })

    history.remove(first.id)
    expect(history.entries.value).toHaveLength(1)
    expect(history.entries.value[0].label).toBe('EMI')

    history.clear()
    expect(history.entries.value).toEqual([])
    expect(globalThis.localStorage.getItem(toolHistoryStorageKey('financial-calculators'))).toBe(
      '[]',
    )
  })

  it('drops oversized or non-object payloads but keeps the entry', () => {
    const history = useToolHistory('gst-calculator')
    const withArrayPayload = history.add({ label: 'A', value: '1', payload: [1, 2, 3] })
    const withHugePayload = history.add({
      label: 'B',
      value: '2',
      payload: { blob: 'x'.repeat(5000) },
    })

    expect(withArrayPayload.payload).toBeUndefined()
    expect(withHugePayload.payload).toBeUndefined()
  })

  it('ignores malformed stored history', () => {
    globalThis.localStorage.setItem(
      toolHistoryStorageKey('currency-converter'),
      JSON.stringify([
        { id: 'ok', label: '1 USD → INR', value: '83 INR', timestamp: 5 },
        { id: 'missing-value', label: '2 USD → INR' },
        { id: 'wrong-type', label: 4, value: '4' },
      ]),
    )

    const history = useToolHistory('currency-converter')
    expect(history.entries.value).toEqual([
      { id: 'ok', label: '1 USD → INR', value: '83 INR', timestamp: 5 },
    ])
  })

  it('continues in memory when storage writes fail', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('Storage denied')
      },
    }
    const history = useToolHistory('gst-calculator', { storage })

    history.add({ label: '₹1,000 + 18%', value: '₹1,180.00' })
    expect(history.entries.value[0]).toMatchObject({ label: '₹1,000 + 18%', value: '₹1,180.00' })
  })
})
