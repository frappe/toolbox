import { describe, expect, it } from 'vitest'

import {
  ANGLE_MODES,
  CalculatorDomainError,
  CalculatorNumericError,
  CalculatorSyntaxError,
  evaluateExpression,
} from './index'

describe('evaluateExpression arithmetic', () => {
  it.each([
    ['2 + 3', 5],
    ['10 - 3 - 2', 5],
    ['2 + 3 * 4', 14],
    ['(2 + 3) * 4', 20],
    ['2 + (3 * (4 + 1))', 17],
    ['.5 + 1.25', 1.75],
    ['6 × 7 ÷ 2', 21],
    ['5 − 8', -3],
  ])('evaluates %s', (expression, expected) => {
    expect(evaluateExpression(expression)).toBe(expected)
  })

  it('applies powers right-to-left and above unary signs', () => {
    expect(evaluateExpression('2^3^2')).toBe(512)
    expect(evaluateExpression('-2^2')).toBe(-4)
    expect(evaluateExpression('(-2)^2')).toBe(4)
    expect(evaluateExpression('2^-2')).toBe(0.25)
    expect(evaluateExpression('--4')).toBe(4)
  })

  it('treats percent as a postfix divide-by-100 operator', () => {
    expect(evaluateExpression('25%')).toBe(0.25)
    expect(evaluateExpression('200 * 10%')).toBe(20)
    expect(evaluateExpression('(50 + 25)%')).toBe(0.75)
  })

  it('supports square, square root, and mathematical constants', () => {
    expect(evaluateExpression('sqrt(81) + square(3)')).toBe(18)
    expect(evaluateExpression('π')).toBe(Math.PI)
    expect(evaluateExpression('PI + e')).toBe(Math.PI + Math.E)
  })

  it('accepts finite scientific-notation numbers', () => {
    expect(evaluateExpression('1.5e3 + 2.5E-1')).toBe(1500.25)
  })
})

describe('evaluateExpression scientific functions', () => {
  it('uses degrees by default', () => {
    expect(evaluateExpression('sin(30)')).toBeCloseTo(0.5)
    expect(evaluateExpression('cos(60)')).toBeCloseTo(0.5)
    expect(evaluateExpression('tan(45)')).toBeCloseTo(1)
    expect(evaluateExpression('asin(0.5)')).toBeCloseTo(30)
    expect(evaluateExpression('acos(0.5)')).toBeCloseTo(60)
    expect(evaluateExpression('atan(1)')).toBeCloseTo(45)
  })

  it('uses radians when requested', () => {
    const options = { angleMode: ANGLE_MODES.RADIANS }

    expect(evaluateExpression('sin(pi / 2)', options)).toBeCloseTo(1)
    expect(evaluateExpression('cos(pi)', options)).toBeCloseTo(-1)
    expect(evaluateExpression('asin(1)', options)).toBeCloseTo(Math.PI / 2)
    expect(evaluateExpression('atan(1)', options)).toBeCloseTo(Math.PI / 4)
  })

  it('calculates base-10 and natural logarithms', () => {
    expect(evaluateExpression('log(1000)')).toBeCloseTo(3)
    expect(evaluateExpression('ln(e)')).toBeCloseTo(1)
  })

  it('rejects unsupported angle modes', () => {
    expect(() => evaluateExpression('sin(30)', { angleMode: 'gradians' })).toThrow(
      'angleMode must be "degrees" or "radians".',
    )
  })
})

describe('evaluateExpression failures', () => {
  it.each([
    ['', 'Enter an expression.'],
    ['2 +', 'Expected a value at the end of the expression.'],
    ['(2 + 3', 'Expected ")" to close the parenthesized expression.'],
    ['()', 'Parentheses cannot be empty.'],
    ['sin()', 'Function "sin" requires a value.'],
    ['sin 30', 'Expected "(" after function "sin".'],
    ['mystery(2)', 'Unknown function or constant "mystery".'],
    ['2 pi', 'Unexpected token "pi" at position 3.'],
    ['2,3', 'Unexpected character "," at position 2.'],
  ])('reports an understandable syntax error for %j', (expression, message) => {
    const error = captureError(() => evaluateExpression(expression))

    expect(error).toBeInstanceOf(CalculatorSyntaxError)
    expect(error.code).toBe('SYNTAX')
    expect(error.message).toBe(message)
  })

  it.each([
    ['1 / 0', 'Cannot divide by zero.'],
    ['sqrt(-1)', 'sqrt is only defined for values greater than or equal to 0.'],
    ['log(0)', 'log is only defined for values greater than 0.'],
    ['ln(-2)', 'ln is only defined for values greater than 0.'],
    ['asin(2)', 'asin is only defined for values from -1 to 1.'],
    ['acos(-2)', 'acos is only defined for values from -1 to 1.'],
    ['tan(90)', 'tan is undefined for this angle.'],
    ['(-1)^0.5', 'The operation is outside the real-number domain.'],
  ])('reports a domain error for %s', (expression, message) => {
    const error = captureError(() => evaluateExpression(expression))

    expect(error).toBeInstanceOf(CalculatorDomainError)
    expect(error.code).toBe('DOMAIN')
    expect(error.message).toBe(message)
  })

  it.each(['1e309', '1e308 * 10', 'square(1e200)'])('rejects numeric overflow in %s', (expression) => {
    const error = captureError(() => evaluateExpression(expression))

    expect(error).toBeInstanceOf(CalculatorNumericError)
    expect(error.code).toBe('NUMERIC')
    expect(error.message).toContain('outside the supported numeric range')
  })

  it('rejects excessive nesting without overflowing the JavaScript call stack', () => {
    const expression = `${'('.repeat(101)}1${')'.repeat(101)}`
    const error = captureError(() => evaluateExpression(expression))

    expect(error).toBeInstanceOf(CalculatorSyntaxError)
    expect(error.message).toBe('Expression is too deeply nested.')
  })
})

describe('evaluateExpression parser safety', () => {
  it.each([
    'globalThis.__calculatorInjected = true',
    'constructor.constructor("globalThis.__calculatorInjected=true")()',
    'this["__calculatorInjected"] = true',
    '1; globalThis.__calculatorInjected = true',
  ])('rejects code input without executing it: %s', (expression) => {
    globalThis.__calculatorInjected = false

    expect(() => evaluateExpression(expression)).toThrow(CalculatorSyntaxError)
    expect(globalThis.__calculatorInjected).toBe(false)
  })
})

function captureError(callback) {
  try {
    callback()
  } catch (error) {
    return error
  }

  throw new Error('Expected callback to throw.')
}
