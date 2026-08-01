import { describe, expect, it } from 'vitest'
import { useHealthCalculators } from './useHealthCalculators'

describe('health calculator workspace', () => {
  it('converts body inputs when the unit system changes', () => {
    const calculator = useHealthCalculators()
    calculator.updateInput('unitSystem', 'imperial')
    expect(Number(calculator.activeValues.value.height)).toBeCloseTo(68.8976, 4)
    expect(Number(calculator.activeValues.value.weight)).toBeCloseTo(154.3236, 4)
    expect(calculator.presentation.value.primary.value).toBe('22.9')
  })

  it('shows bounded input errors and recovers after reset', () => {
    const calculator = useHealthCalculators()
    calculator.updateInput('height', '0')
    expect(calculator.errorMessage.value).toContain('Height must be between')
    calculator.reset()
    expect(calculator.errorMessage.value).toBe('')
  })

  it('changes pace fields based on the selected missing value', () => {
    const calculator = useHealthCalculators()
    calculator.selectCalculator('pace')
    calculator.updateInput('solveFor', 'distance')
    expect(calculator.activeInputs.value.map(({ id }) => id)).toEqual(['solveFor', 'distanceUnit', 'duration', 'pace'])
    expect(calculator.presentation.value.primary.label).toBe('Distance')
  })
})
