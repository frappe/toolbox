import { describe, expect, it } from 'vitest'

import { ALL_SCHEMES, convertScript, detectScript, schemeLabel } from './scriptConversion'

describe('convertScript', () => {
  it('transliterates Roman ITRANS into Devanagari', () => {
    expect(convertScript('namaste', 'itrans', 'devanagari')).toBe('नमस्ते')
  })

  it('transliterates Devanagari into IAST and other scripts', () => {
    expect(convertScript('नमस्ते', 'devanagari', 'iast')).toBe('namaste')
    expect(convertScript('नमस्ते', 'devanagari', 'tamil')).toBe('நமஸ்தே')
  })

  it('preserves line breaks', () => {
    expect(convertScript('namaste\nnamaste', 'itrans', 'devanagari')).toBe('नमस्ते\nनमस्ते')
  })

  it('returns the text unchanged when schemes match', () => {
    expect(convertScript('abc', 'iast', 'iast')).toBe('abc')
  })

  it('returns empty for empty or invalid input', () => {
    expect(convertScript('', 'itrans', 'devanagari')).toBe('')
    expect(convertScript('x', 'nonsense', 'devanagari')).toBe('')
    expect(convertScript('x', 'itrans', 'nonsense')).toBe('')
  })
})

describe('detectScript', () => {
  it('detects a known script and returns a valid scheme id', () => {
    expect(detectScript('नमस्ते')).toBe('devanagari')
  })

  it('returns empty for blank input', () => {
    expect(detectScript('   ')).toBe('')
  })
})

describe('schemeLabel', () => {
  it('returns the human label for a scheme id', () => {
    expect(schemeLabel('devanagari')).toBe('Devanagari')
    expect(schemeLabel('iast')).toBe('IAST')
  })

  it('exposes both scripts and Roman schemes', () => {
    const ids = ALL_SCHEMES.map((s) => s.id)
    expect(ids).toContain('tamil')
    expect(ids).toContain('itrans')
  })
})
