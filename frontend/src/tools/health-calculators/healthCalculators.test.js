import { describe, expect, it } from 'vitest'
import { calculateBmi, calculateBmr, calculateMaintenance, calculatePace, formatClockDuration, getBmiCategory, parseClockDuration } from './healthCalculators'

describe('health calculators', () => {
  it('matches the documented adult BMI example and category boundaries', () => {
    expect(calculateBmi({ unitSystem: 'imperial', height: 67, weight: 170 }).bmi).toBeCloseTo(26.6, 1)
    expect([18.49, 18.5, 25, 30, 35, 40].map(getBmiCategory)).toEqual(['Underweight', 'Healthy weight', 'Overweight', 'Class 1 obesity', 'Class 2 obesity', 'Class 3 obesity'])
  })

  it('agrees between metric and imperial BMI inputs', () => {
    const metric = calculateBmi({ unitSystem: 'metric', height: 175, weight: 70 })
    const imperial = calculateBmi({ unitSystem: 'imperial', height: 68.8976378, weight: 154.323584 })
    expect(imperial.bmi).toBeCloseTo(metric.bmi, 6)
  })

  it('uses the Mifflin-St Jeor equations', () => {
    expect(calculateBmr({ unitSystem: 'metric', height: 180, weight: 80, age: 40, sex: 'male' }).bmr).toBe(1730)
    expect(calculateBmr({ unitSystem: 'metric', height: 165, weight: 60, age: 30, sex: 'female' }).bmr).toBeCloseTo(1320.25, 2)
  })

  it('applies the selected maintenance activity assumption', () => {
    const result = calculateMaintenance({ unitSystem: 'metric', height: 180, weight: 80, age: 40, sex: 'male', activityMultiplier: 1.55 })
    expect(result.calories).toBeCloseTo(2681.5, 1)
  })

  it('calculates any missing pace value and parses clock inputs', () => {
    expect(calculatePace({ solveFor: 'pace', distance: 10, duration: '50:00', distanceUnit: 'km' }).pace).toBe(300)
    expect(calculatePace({ solveFor: 'duration', distance: 5, pace: '06:00', distanceUnit: 'km' }).duration).toBe(1800)
    expect(calculatePace({ solveFor: 'distance', duration: '1:00:00', pace: '05:00', distanceUnit: 'km' }).distance).toBe(12)
    expect(parseClockDuration('1:02:03')).toBe(3723)
    expect(formatClockDuration(3723)).toBe('1:02:03')
  })
})
