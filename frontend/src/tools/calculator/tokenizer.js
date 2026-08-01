import { CalculatorNumericError, CalculatorSyntaxError } from './errors'

const MAX_EXPRESSION_LENGTH = 4096
const NUMBER_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/
const OPERATOR_ALIASES = Object.freeze({
  '×': '*',
  '÷': '/',
  '−': '-',
})

export class Tokenizer {
  constructor(expression) {
    this.expression = expression
    this.position = 0
  }

  tokenize() {
    this.validateExpression()
    const tokens = []

    while (this.position < this.expression.length) {
      const character = this.expression[this.position]

      if (/\s/.test(character)) {
        this.position += 1
        continue
      }

      if (isNumberStart(character, this.expression[this.position + 1])) {
        tokens.push(this.readNumber())
        continue
      }

      if (isIdentifierStart(character)) {
        tokens.push(this.readIdentifier())
        continue
      }

      if ('+-*/^%'.includes(character) || OPERATOR_ALIASES[character]) {
        tokens.push(this.createToken('operator', OPERATOR_ALIASES[character] ?? character))
        this.position += 1
        continue
      }

      if (character === '(' || character === ')') {
        tokens.push(this.createToken(character === '(' ? 'left-parenthesis' : 'right-parenthesis', character))
        this.position += 1
        continue
      }

      throw new CalculatorSyntaxError(
        `Unexpected character "${character}" at position ${this.position + 1}.`,
        this.position,
      )
    }

    tokens.push({ type: 'end', value: '', position: this.expression.length })
    return tokens
  }

  validateExpression() {
    if (typeof this.expression !== 'string') {
      throw new CalculatorSyntaxError('Expression must be text.')
    }

    if (!this.expression.trim()) {
      throw new CalculatorSyntaxError('Enter an expression.')
    }

    if (this.expression.length > MAX_EXPRESSION_LENGTH) {
      throw new CalculatorSyntaxError('Expression is too long.')
    }
  }

  readNumber() {
    const start = this.position
    const match = this.expression.slice(start).match(NUMBER_PATTERN)
    const rawValue = match[0]
    const value = Number(rawValue)
    this.position += rawValue.length

    if (!Number.isFinite(value)) {
      throw new CalculatorNumericError(
        `Number at position ${start + 1} is outside the supported numeric range.`,
        start,
      )
    }

    return { type: 'number', value, rawValue, position: start }
  }

  readIdentifier() {
    const start = this.position
    this.position += 1

    while (isIdentifierPart(this.expression[this.position])) {
      this.position += 1
    }

    const rawValue = this.expression.slice(start, this.position)
    const value = rawValue === 'π' ? 'pi' : rawValue.toLowerCase()
    return { type: 'identifier', value, rawValue, position: start }
  }

  createToken(type, value) {
    return { type, value, position: this.position }
  }
}

function isNumberStart(character, nextCharacter) {
  return /\d/.test(character) || (character === '.' && /\d/.test(nextCharacter))
}

function isIdentifierStart(character) {
  return typeof character === 'string' && (/[A-Za-z_]/.test(character) || character === 'π')
}

function isIdentifierPart(character) {
  return typeof character === 'string' && /[A-Za-z0-9_]/.test(character)
}
