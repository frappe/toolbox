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

  it('shows an obesity subclass label and cites the WHO and CDC authorities behind it', () => {
    const calculator = useHealthCalculators()
    calculator.updateInput('weight', '130')
    expect(calculator.presentation.value.rows[0].value).toBe('Class 3 obesity')
    expect(calculator.presentation.value.assumption).toContain('WHO and CDC')
  })
})

describe('the measurements the four calculators share', () => {
  it('carries a height and weight typed in one into the others', () => {
    // This is the reason the four share a view, and it was the one thing they did not do.
    const health = useHealthCalculators('bmi')
    health.updateInput('height', '180')
    health.updateInput('weight', '82')

    health.selectCalculator('bmr')
    expect(health.activeValues.value.height).toBe('180')
    expect(health.activeValues.value.weight).toBe('82')

    health.selectCalculator('maintenance')
    expect(health.activeValues.value.height).toBe('180')
  })

  it('carries age and sex, which BMR and maintenance both ask for', () => {
    const health = useHealthCalculators('bmr')
    health.updateInput('age', '41')
    health.updateInput('sex', 'female')

    health.selectCalculator('maintenance')
    expect(health.activeValues.value.age).toBe('41')
    expect(health.activeValues.value.sex).toBe('female')
  })

  it('keeps what belongs to one calculator alone', () => {
    const health = useHealthCalculators('maintenance')
    health.updateInput('activityMultiplier', '1.9')

    health.selectCalculator('pace')
    expect(health.activeValues.value.activityMultiplier).toBeUndefined()
    expect(health.activeValues.value.distance).toBe('5')

    health.selectCalculator('maintenance')
    expect(health.activeValues.value.activityMultiplier).toBe('1.9')
  })

  it('converts every calculator when the unit system changes', () => {
    // Converting only the one on screen leaves the others reading imperial numbers under metric
    // labels, which is worse than not sharing at all.
    const health = useHealthCalculators('bmi')
    health.updateInput('unitSystem', 'imperial')

    health.selectCalculator('bmr')
    expect(health.activeValues.value.unitSystem).toBe('imperial')
    expect(Number(health.activeValues.value.height)).toBeCloseTo(68.9, 1)
    expect(Number(health.activeValues.value.weight)).toBeCloseTo(154.3, 1)
  })

  it('resets a shared measurement everywhere it is shared', () => {
    const health = useHealthCalculators('bmi')
    health.updateInput('height', '180')
    health.reset()

    health.selectCalculator('bmr')
    expect(health.activeValues.value.height).toBe('175')
  })
})
