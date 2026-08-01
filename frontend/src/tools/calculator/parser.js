import { CalculatorSyntaxError } from './errors'

const CONSTANTS = new Set(['pi', 'e'])
const FUNCTIONS = new Set([
  'square',
  'sqrt',
  'log',
  'ln',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
])
const MAX_NESTING_DEPTH = 100

export class Parser {
  constructor(tokens) {
    this.tokens = tokens
    this.position = 0
  }

  parse() {
    const expression = this.parseAdditive(0)

    if (!this.check('end')) {
      throw this.unexpectedToken(this.current())
    }

    return expression
  }

  parseAdditive(depth) {
    let expression = this.parseMultiplicative(depth)

    while (this.matchOperator('+', '-')) {
      const operator = this.previous().value
      const right = this.parseMultiplicative(depth)
      expression = { type: 'binary', operator, left: expression, right }
    }

    return expression
  }

  parseMultiplicative(depth) {
    let expression = this.parseUnary(depth)

    while (this.matchOperator('*', '/')) {
      const operator = this.previous().value
      const right = this.parseUnary(depth)
      expression = { type: 'binary', operator, left: expression, right }
    }

    return expression
  }

  parseUnary(depth) {
    if (this.matchOperator('+', '-')) {
      this.assertDepth(depth + 1)
      return {
        type: 'unary',
        operator: this.previous().value,
        argument: this.parseUnary(depth + 1),
      }
    }

    return this.parsePower(depth)
  }

  parsePower(depth) {
    let expression = this.parsePostfix(depth)

    if (this.matchOperator('^')) {
      this.assertDepth(depth + 1)
      expression = {
        type: 'binary',
        operator: '^',
        left: expression,
        right: this.parseUnary(depth + 1),
      }
    }

    return expression
  }

  parsePostfix(depth) {
    let expression = this.parsePrimary(depth)

    while (this.matchOperator('%')) {
      expression = { type: 'percent', argument: expression }
    }

    return expression
  }

  parsePrimary(depth) {
    if (this.match('number')) {
      return { type: 'number', value: this.previous().value }
    }

    if (this.match('identifier')) {
      return this.parseIdentifier(this.previous(), depth)
    }

    if (this.match('left-parenthesis')) {
      return this.parseParenthesized(depth)
    }

    const token = this.current()
    const location = token.type === 'end' ? 'at the end of the expression' : `at position ${token.position + 1}`
    throw new CalculatorSyntaxError(`Expected a value ${location}.`, token.position)
  }

  parseIdentifier(token, depth) {
    if (CONSTANTS.has(token.value)) {
      return { type: 'constant', name: token.value }
    }

    if (!FUNCTIONS.has(token.value)) {
      throw new CalculatorSyntaxError(
        `Unknown function or constant "${token.rawValue}".`,
        token.position,
      )
    }

    if (!this.match('left-parenthesis')) {
      throw new CalculatorSyntaxError(
        `Expected "(" after function "${token.rawValue}".`,
        this.current().position,
      )
    }

    this.assertDepth(depth + 1)
    if (this.check('right-parenthesis')) {
      throw new CalculatorSyntaxError(
        `Function "${token.rawValue}" requires a value.`,
        this.current().position,
      )
    }

    const argument = this.parseAdditive(depth + 1)
    this.consumeRightParenthesis(`function "${token.rawValue}"`)
    return { type: 'function', name: token.value, argument }
  }

  parseParenthesized(depth) {
    this.assertDepth(depth + 1)
    if (this.check('right-parenthesis')) {
      throw new CalculatorSyntaxError('Parentheses cannot be empty.', this.current().position)
    }

    const expression = this.parseAdditive(depth + 1)
    this.consumeRightParenthesis('parenthesized expression')
    return expression
  }

  consumeRightParenthesis(context) {
    if (this.match('right-parenthesis')) {
      return
    }

    throw new CalculatorSyntaxError(
      `Expected ")" to close the ${context}.`,
      this.current().position,
    )
  }

  assertDepth(depth) {
    if (depth > MAX_NESTING_DEPTH) {
      throw new CalculatorSyntaxError('Expression is too deeply nested.', this.current().position)
    }
  }

  match(type) {
    if (!this.check(type)) {
      return false
    }

    this.position += 1
    return true
  }

  matchOperator(...operators) {
    if (!this.check('operator') || !operators.includes(this.current().value)) {
      return false
    }

    this.position += 1
    return true
  }

  check(type) {
    return this.current().type === type
  }

  current() {
    return this.tokens[this.position]
  }

  previous() {
    return this.tokens[this.position - 1]
  }

  unexpectedToken(token) {
    const value = token.rawValue ?? token.value
    return new CalculatorSyntaxError(
      `Unexpected token "${value}" at position ${token.position + 1}.`,
      token.position,
    )
  }
}
