import Sanscript from '@indic-transliteration/sanscript'

// Deterministic, offline script (transliteration) conversion via Sanscript (MIT, pure JS).
// This converts *writing systems* preserving approximate pronunciation — it is NOT translation.

// Brahmic scripts we expose. `id` matches a Sanscript scheme key.
export const SCRIPT_SCHEMES = [
  { id: 'devanagari', label: 'Devanagari', hint: 'Hindi, Marathi, Sanskrit' },
  { id: 'bengali', label: 'Bengali', hint: 'Bengali, Assamese' },
  { id: 'gujarati', label: 'Gujarati' },
  { id: 'gurmukhi', label: 'Gurmukhi', hint: 'Punjabi' },
  { id: 'kannada', label: 'Kannada' },
  { id: 'malayalam', label: 'Malayalam' },
  { id: 'oriya', label: 'Odia' },
  { id: 'tamil', label: 'Tamil' },
  { id: 'telugu', label: 'Telugu' },
  { id: 'grantha', label: 'Grantha' },
  { id: 'sinhala', label: 'Sinhala' },
]

// Roman (Latin) transliteration schemes.
export const ROMAN_SCHEMES = [
  { id: 'iast', label: 'IAST', hint: 'Roman with diacritics' },
  { id: 'iso', label: 'ISO 15919', hint: 'Roman with diacritics' },
  { id: 'itrans', label: 'ITRANS', hint: 'Roman, ASCII' },
  { id: 'hk', label: 'Harvard-Kyoto', hint: 'Roman, ASCII' },
  { id: 'slp1', label: 'SLP1', hint: 'Roman, ASCII' },
  { id: 'velthuis', label: 'Velthuis', hint: 'Roman, ASCII' },
  { id: 'wx', label: 'WX', hint: 'Roman, ASCII' },
]

export const ALL_SCHEMES = [...SCRIPT_SCHEMES, ...ROMAN_SCHEMES]

const VALID = new Set(ALL_SCHEMES.map((scheme) => scheme.id))

export function schemeLabel(id) {
  const scheme = ALL_SCHEMES.find((s) => s.id === id)
  return scheme ? scheme.label : id
}

// Convert `text` from one scheme to another. Line breaks and unknown characters pass through
// (Sanscript leaves untransliterable text as-is). Returns '' on invalid input rather than throwing.
export function convertScript(text, from, to) {
  if (!text) return ''
  if (!VALID.has(from) || !VALID.has(to)) return ''
  if (from === to) return text
  try {
    return Sanscript.t(text, from, to)
  } catch {
    return ''
  }
}

// Best-effort source-script detection; returns one of our scheme ids or '' when unsure.
export function detectScript(text) {
  if (!text || !text.trim()) return ''
  try {
    const detected = (Sanscript.detect(text) || '').toLowerCase()
    return VALID.has(detected) ? detected : ''
  } catch {
    return ''
  }
}
