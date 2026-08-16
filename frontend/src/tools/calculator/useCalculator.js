import { ref } from 'vue'

import { ANGLE_MODES, CalculatorError, evaluateExpression } from './index'
import { formatCalculatorResult } from './formatCalculatorResult'

const NUMBER_AT_END_PATTERN = /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u
const CURRENT_TOKEN_PATTERN = /(?:\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|[A-Za-z]+\(?|π)$/u

export function useCalculator() {
  const expression = ref('')
  const result = ref('')
  const errorMessage = ref('')
  const angleMode = ref(ANGLE_MODES.DEGREES)
  const justEvaluated = ref(false)

  function calculate() {
    try {
      const value = evaluateExpression(expression.value, { angleMode: angleMode.value })
      result.value = formatCalculatorResult(value)
      errorMessage.value = ''
      justEvaluated.value = true
      return true
    } catch (error) {
      result.value = ''
      errorMessage.value = error instanceof CalculatorError
        ? error.message
        : 'The calculation could not be completed.'
      justEvaluated.value = false
      return false
    }
  }

  function updateExpression(value) {
    expression.value = String(value)
    markEdited()
  }

  function insertText(text, selectionStart, selectionEnd, { startsNewExpression = false } = {}) {
    const continuingFromResult = justEvaluated.value
    const base = continuingFromResult
      ? (startsNewExpression ? '' : result.value)
      : expression.value
    const [start, end] = continuingFromResult
      ? [base.length, base.length]
      : normalizeSelection(base, selectionStart, selectionEnd)
    expression.value = `${base.slice(0, start)}${text}${base.slice(end)}`
    markEdited()
    return start + text.length
  }

  function backspace(selectionStart, selectionEnd) {
    const [start, end] = normalizeSelection(expression.value, selectionStart, selectionEnd)
    const deleteFrom = start === end ? Math.max(0, start - 1) : start
    expression.value = `${expression.value.slice(0, deleteFrom)}${expression.value.slice(end)}`
    markEdited()
    return deleteFrom
  }

  function clearCurrentInput(selectionStart, selectionEnd) {
    const [start, end] = normalizeSelection(expression.value, selectionStart, selectionEnd)
    if (start !== end) return removeRange(start, end)

    const token = expression.value.slice(0, start).match(CURRENT_TOKEN_PATTERN)
    const deleteFrom = token?.index ?? Math.max(0, start - 1)
    return removeRange(deleteFrom, end)
  }

  function toggleSign(selectionStart, selectionEnd) {
    const [start, end] = normalizeSelection(expression.value, selectionStart, selectionEnd)
    if (start !== end) {
      const selectedValue = expression.value.slice(start, end)
      expression.value = `${expression.value.slice(0, start)}-(${selectedValue})${expression.value.slice(end)}`
      markEdited()
      return start + selectedValue.length + 3
    }

    const number = expression.value.slice(0, start).match(NUMBER_AT_END_PATTERN)
    if (!number) return insertText('-', start, end)

    const numberStart = number.index
    const signIndex = numberStart - 1
    if (isUnaryMinus(expression.value, signIndex)) {
      expression.value = `${expression.value.slice(0, signIndex)}${expression.value.slice(numberStart)}`
      markEdited()
      return start - 1
    }

    expression.value = `${expression.value.slice(0, numberStart)}-${expression.value.slice(numberStart)}`
    markEdited()
    return start + 1
  }

  function clearExpression() {
    expression.value = ''
    result.value = ''
    errorMessage.value = ''
    justEvaluated.value = false
  }

  function setAngleMode(mode) {
    if (!Object.values(ANGLE_MODES).includes(mode)) return
    angleMode.value = mode
    result.value = ''
    errorMessage.value = ''
    justEvaluated.value = false
  }

  function removeRange(start, end) {
    expression.value = `${expression.value.slice(0, start)}${expression.value.slice(end)}`
    markEdited()
    return start
  }

  function markEdited() {
    result.value = ''
    errorMessage.value = ''
    justEvaluated.value = false
  }

  return {
    expression,
    result,
    errorMessage,
    angleMode,
    calculate,
    updateExpression,
    insertText,
    backspace,
    clearCurrentInput,
    toggleSign,
    clearExpression,
    setAngleMode,
  }
}

function normalizeSelection(value, selectionStart, selectionEnd) {
  const start = clampSelection(selectionStart, value.length)
  const end = clampSelection(selectionEnd, value.length)
  return start <= end ? [start, end] : [end, start]
}

function clampSelection(position, maximum) {
  if (!Number.isInteger(position)) return maximum
  return Math.min(Math.max(position, 0), maximum)
}

function isUnaryMinus(expression, signIndex) {
  if (signIndex < 0 || expression[signIndex] !== '-') return false
  return signIndex === 0 || /[+\-*/^(]/u.test(expression[signIndex - 1])
}
