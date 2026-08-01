export class FinancialCalculationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'FinancialCalculationError'
  }
}
