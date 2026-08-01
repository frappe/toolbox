export class HealthCalculationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'HealthCalculationError'
  }
}
