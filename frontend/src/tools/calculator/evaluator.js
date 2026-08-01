import { CalculatorDomainError, CalculatorNumericError } from './errors'

const UNDEFINED_TANGENT_THRESHOLD = 1e-12

export class Evaluator {
  constructor(angleMode) {
    this.angleMode = angleMode
  }

  evaluate(expression) {
    return this.evaluateNode(expression)
  }

  evaluateNode(node) {
    switch (node.type) {
      case 'number':
        return node.value
      case 'constant':
        return node.name === 'pi' ? Math.PI : Math.E
      case 'unary':
        return this.evaluateUnary(node)
      case 'percent':
        return this.ensureFinite(this.evaluateNode(node.argument) / 100)
      case 'binary':
        return this.evaluateBinary(node)
      case 'function':
        return this.evaluateFunction(node)
      default:
        throw new TypeError(`Unknown calculator node type: ${node.type}`)
    }
  }

  evaluateUnary(node) {
    const value = this.evaluateNode(node.argument)
    return this.ensureFinite(node.operator === '-' ? -value : value)
  }

  evaluateBinary(node) {
    const left = this.evaluateNode(node.left)
    const right = this.evaluateNode(node.right)

    if (node.operator === '/' && right === 0) {
      throw new CalculatorDomainError('Cannot divide by zero.')
    }

    const operations = {
      '+': () => left + right,
      '-': () => left - right,
      '*': () => left * right,
      '/': () => left / right,
      '^': () => left ** right,
    }
    return this.ensureFinite(operations[node.operator]())
  }

  evaluateFunction(node) {
    const value = this.evaluateNode(node.argument)
    const functions = {
      square: () => value * value,
      sqrt: () => this.squareRoot(value),
      log: () => this.logarithm(value, 10),
      ln: () => this.logarithm(value, Math.E),
      sin: () => Math.sin(this.toRadians(value)),
      cos: () => Math.cos(this.toRadians(value)),
      tan: () => this.tangent(value),
      asin: () => this.inverseTrig('asin', value),
      acos: () => this.inverseTrig('acos', value),
      atan: () => this.fromRadians(Math.atan(value)),
    }

    return this.ensureFinite(functions[node.name]())
  }

  squareRoot(value) {
    if (value < 0) {
      throw new CalculatorDomainError('sqrt is only defined for values greater than or equal to 0.')
    }

    return Math.sqrt(value)
  }

  logarithm(value, base) {
    if (value <= 0) {
      const name = base === 10 ? 'log' : 'ln'
      throw new CalculatorDomainError(`${name} is only defined for values greater than 0.`)
    }

    return base === 10 ? Math.log10(value) : Math.log(value)
  }

  tangent(value) {
    const radians = this.toRadians(value)

    if (Math.abs(Math.cos(radians)) < UNDEFINED_TANGENT_THRESHOLD) {
      throw new CalculatorDomainError('tan is undefined for this angle.')
    }

    return Math.tan(radians)
  }

  inverseTrig(name, value) {
    if (value < -1 || value > 1) {
      throw new CalculatorDomainError(`${name} is only defined for values from -1 to 1.`)
    }

    return this.fromRadians(Math[name](value))
  }

  toRadians(value) {
    return this.angleMode === 'degrees' ? value * (Math.PI / 180) : value
  }

  fromRadians(value) {
    return this.angleMode === 'degrees' ? value * (180 / Math.PI) : value
  }

  ensureFinite(value) {
    if (Number.isNaN(value)) {
      throw new CalculatorDomainError('The operation is outside the real-number domain.')
    }

    if (!Number.isFinite(value)) {
      throw new CalculatorNumericError('The result is outside the supported numeric range.')
    }

    return value
  }
}
