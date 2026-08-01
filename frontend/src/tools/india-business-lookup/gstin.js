const CHECKSUM_CHARACTERS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const GST_STATE_CODES = Object.freeze({
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  10: 'Bihar',
  11: 'Sikkim',
  12: 'Arunachal Pradesh',
  13: 'Nagaland',
  14: 'Manipur',
  15: 'Mizoram',
  16: 'Tripura',
  17: 'Meghalaya',
  18: 'Assam',
  19: 'West Bengal',
  20: 'Jharkhand',
  21: 'Odisha',
  22: 'Chhattisgarh',
  23: 'Madhya Pradesh',
  24: 'Gujarat',
  25: 'Daman and Diu (legacy)',
  26: 'Dadra and Nagar Haveli and Daman and Diu',
  27: 'Maharashtra',
  28: 'Andhra Pradesh (legacy)',
  29: 'Karnataka',
  30: 'Goa',
  31: 'Lakshadweep',
  32: 'Kerala',
  33: 'Tamil Nadu',
  34: 'Puducherry',
  35: 'Andaman and Nicobar Islands',
  36: 'Telangana',
  37: 'Andhra Pradesh',
  38: 'Ladakh',
  97: 'Other Territory',
  99: 'Centre Jurisdiction',
})

export function normalizeGstin(value) {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase()
}

export function validateGstin(value) {
  const gstin = normalizeGstin(value)
  const stateCode = gstin.slice(0, 2)
  const pan = gstin.slice(2, 12)
  const registrationSequence = gstin.slice(12, 14)
  const errors = []

  if (gstin.length !== 15) errors.push('GSTIN must contain exactly 15 characters.')
  if (gstin && !/^[0-9A-Z]+$/.test(gstin)) errors.push('GSTIN can contain only letters and numbers.')
  if (gstin.length >= 2 && !GST_STATE_CODES[stateCode]) errors.push('The first two characters are not a recognised GST state code.')
  if (gstin.length >= 12 && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) errors.push('The embedded PAN must use the format AAAAA9999A.')
  if (gstin.length >= 14 && !/^[1-9A-Z]Z$/.test(registrationSequence)) {
    errors.push('The registration sequence must contain a non-zero entity code followed by Z.')
  }

  const expectedChecksum = gstin.length === 15 && /^[0-9A-Z]{15}$/.test(gstin)
    ? calculateGstinChecksum(gstin.slice(0, 14))
    : null
  const checksumValid = expectedChecksum !== null && gstin[14] === expectedChecksum

  if (expectedChecksum !== null && !checksumValid) errors.push(`The checksum should be ${expectedChecksum}.`)

  return {
    gstin,
    valid: errors.length === 0,
    errors,
    stateCode,
    state: GST_STATE_CODES[stateCode] ?? null,
    pan,
    registrationSequence,
    checksum: gstin[14] ?? '',
    expectedChecksum,
    checksumValid,
  }
}

export function calculateGstinChecksum(firstFourteenCharacters) {
  const input = normalizeGstin(firstFourteenCharacters)
  if (!/^[0-9A-Z]{14}$/.test(input)) return null

  let factor = 1
  let total = 0
  for (const character of input) {
    const product = factor * CHECKSUM_CHARACTERS.indexOf(character)
    total += Math.floor(product / CHECKSUM_CHARACTERS.length) + (product % CHECKSUM_CHARACTERS.length)
    factor = factor === 1 ? 2 : 1
  }

  return CHECKSUM_CHARACTERS[(CHECKSUM_CHARACTERS.length - (total % CHECKSUM_CHARACTERS.length)) % CHECKSUM_CHARACTERS.length]
}
