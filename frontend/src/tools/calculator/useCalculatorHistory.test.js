import { describe, expect, it } from 'vitest'

import {
  CALCULATOR_HISTORY_KEY,
  MAX_CALCULATOR_HISTORY_ENTRIES,
  useCalculatorHistory,
} from './useCalculatorHistory'

describe('useCalculatorHistory', () => {
  it('persists only expression and result records in browser storage', () => {
    const history = useCalculatorHistory()
    const entry = history.add('1 + 2', '3')
    const storedEntries = JSON.parse(globalThis.sessionStorage.getItem(CALCULATOR_HISTORY_KEY))

    expect(storedEntries).toEqual([entry])
    expect(storedEntries[0]).toEqual({
      id: expect.any(String),
      expression: '1 + 2',
      result: '3',
      timestamp: expect.any(Number),
    })
    expect(useCalculatorHistory().entries.value).toEqual([entry])
  })

  it('keeps the newest bounded set of calculations', () => {
    const history = useCalculatorHistory()

    for (let index = 0; index < MAX_CALCULATOR_HISTORY_ENTRIES + 5; index += 1) {
      history.add(`${index} + 1`, String(index + 1))
    }

    expect(history.entries.value).toHaveLength(MAX_CALCULATOR_HISTORY_ENTRIES)
    expect(history.entries.value[0].expression).toBe('54 + 1')
    expect(history.entries.value.at(-1).expression).toBe('5 + 1')
  })

  it('ignores malformed or untrusted stored history', () => {
    globalThis.sessionStorage.setItem(CALCULATOR_HISTORY_KEY, JSON.stringify([
      { id: 'valid', expression: '2 + 2', result: '4' },
      { id: 'missing-result', expression: '2 + 3' },
      { id: 'wrong-type', expression: 4, result: '4' },
    ]))

    expect(useCalculatorHistory().entries.value).toEqual([
      { id: 'valid', expression: '2 + 2', result: '4' },
    ])
  })

  it('continues in memory when storage writes fail', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('Storage denied')
      },
    }
    const history = useCalculatorHistory({ storage })

    history.add('5 * 5', '25')
    expect(history.entries.value[0]).toMatchObject({ expression: '5 * 5', result: '25' })
  })
})

describe('where the calculator history is kept', () => {
  it('uses sessionStorage, so what somebody worked out goes with the session', () => {
    useCalculatorHistory().add('1 + 2', '3')

    expect(globalThis.sessionStorage.getItem(CALCULATOR_HISTORY_KEY)).toBeTruthy()
    expect(globalThis.localStorage.getItem(CALCULATOR_HISTORY_KEY)).toBeNull()
  })

  it('forgets the key the old default left on a returning visitor', () => {
    globalThis.localStorage.setItem(CALCULATOR_HISTORY_KEY, JSON.stringify([{ id: 'old', expression: '1', result: '1', timestamp: 1 }]))

    expect(useCalculatorHistory().entries.value).toEqual([])
    expect(globalThis.localStorage.getItem(CALCULATOR_HISTORY_KEY)).toBeNull()
  })
})
