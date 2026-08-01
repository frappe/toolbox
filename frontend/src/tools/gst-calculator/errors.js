export class GstCalculationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'GstCalculationError'
    this.code = code
  }
}
