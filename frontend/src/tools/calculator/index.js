import { Evaluator } from './evaluator'
import { Parser } from './parser'
import { Tokenizer } from './tokenizer'

export {
  CalculatorDomainError,
  CalculatorError,
  CalculatorNumericError,
  CalculatorSyntaxError,
} from './errors'

export const ANGLE_MODES = Object.freeze({
  DEGREES: 'degrees',
  RADIANS: 'radians',
})

const VALID_ANGLE_MODES = new Set(Object.values(ANGLE_MODES))

export function evaluateExpression(expression, { angleMode = ANGLE_MODES.DEGREES } = {}) {
  if (!VALID_ANGLE_MODES.has(angleMode)) {
    throw new TypeError('angleMode must be "degrees" or "radians".')
  }

  const tokens = new Tokenizer(expression).tokenize()
  const syntaxTree = new Parser(tokens).parse()
  return new Evaluator(angleMode).evaluate(syntaxTree)
}
