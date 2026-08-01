import { describe, expect, it } from 'vitest'

import { calculateGstinChecksum, normalizeGstin, validateGstin } from './gstin'

// GSTN's developer sample, preserved in its published GSTINValidator.java:
// http://developer.gstsystem.co.in/apiportal/howToStart/download
const GSTN_SAMPLE = '09AAAUP8175A1ZG'

describe('GSTIN validation', () => {
  it('accepts the documented GSTN sample and parses every component', () => {
    expect(validateGstin(GSTN_SAMPLE)).toMatchObject({
      valid: true,
      state: 'Uttar Pradesh',
      stateCode: '09',
      pan: 'AAAUP8175A',
      registrationSequence: '1Z',
      checksum: 'G',
      expectedChecksum: 'G',
      checksumValid: true,
    })
  })

  it('normalizes casing and harmless pasted whitespace', () => {
    expect(normalizeGstin(' 09aaaup8175a 1zg ')).toBe(GSTN_SAMPLE)
    expect(validateGstin(' 09aaaup8175a 1zg ').valid).toBe(true)
  })

  it.each([
    ['09AAAUP8175A1Z', 'exactly 15 characters'],
    ['09AAAUP8175A1Z!', 'only letters and numbers'],
    ['00AAAUP8175A1Z4', 'recognised GST state code'],
    ['09AA1UP8175A1ZC', 'embedded PAN'],
    ['09AAAUP8175A0Z8', 'registration sequence'],
    ['09AAAUP8175A1Z0', 'checksum should be G'],
  ])('rejects %s because it violates %s', (gstin, message) => {
    const result = validateGstin(gstin)

    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain(message)
  })

  it('uses the GSTN modulo-36 checksum calculation', () => {
    expect(calculateGstinChecksum('09AAAUP8175A1Z')).toBe('G')
    expect(calculateGstinChecksum('invalid')).toBeNull()
  })
})
