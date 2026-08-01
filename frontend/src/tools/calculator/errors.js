export class CalculatorError extends Error {
  constructor(message, { code, position = null }) {
    super(message)
    this.name = new.target.name
    this.code = code

    if (position !== null) {
      this.position = position
    }
  }
}

export class CalculatorSyntaxError extends CalculatorError {
  constructor(message, position = null) {
    super(message, { code: 'SYNTAX', position })
  }
}

export class CalculatorDomainError extends CalculatorError {
  constructor(message) {
    super(message, { code: 'DOMAIN' })
  }
}

export class CalculatorNumericError extends CalculatorError {
  constructor(message, position = null) {
    super(message, { code: 'NUMERIC', position })
  }
}
