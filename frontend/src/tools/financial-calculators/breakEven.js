import { FinancialCalculationError } from './errors'
import {
  requireAtMost,
  requireFiniteResult,
  requireNonNegative,
  requirePositive,
} from './validation'

export function calculateBreakEven({ fixedCost, sellingPrice, variableCost }) {
  requireNonNegative(fixedCost, 'Fixed cost')
  requirePositive(sellingPrice, 'Selling price per unit')
  requireNonNegative(variableCost, 'Variable cost per unit')
  requireAtMost(fixedCost, 1_000_000_000_000_000, 'Fixed cost')
  requireAtMost(sellingPrice, 1_000_000_000_000_000, 'Selling price per unit')
  requireAtMost(variableCost, 1_000_000_000_000_000, 'Variable cost per unit')

  const contributionPerUnit = sellingPrice - variableCost
  if (contributionPerUnit <= 0) {
    throw new FinancialCalculationError(
      'Selling price must be greater than variable cost per unit.',
    )
  }

  const exactQuantity = requireFiniteResult(fixedCost / contributionPerUnit)
  const breakEvenQuantity = Math.ceil(exactQuantity)

  return {
    fixedCost,
    sellingPrice,
    variableCost,
    contributionPerUnit,
    exactQuantity,
    breakEvenQuantity,
    breakEvenRevenue: breakEvenQuantity * sellingPrice,
  }
}
