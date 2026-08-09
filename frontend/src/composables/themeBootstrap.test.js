import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { PREFERENCES_STORAGE_KEY, THEME_STORAGE_KEY } from './useToolboxPreferences'

// `frontend/index.html` resolves the theme in an inline script, before the bundle loads, so a
// visitor who chose dark never sees a white flash. That script duplicates a storage key the store
// owns, and nothing else links the two files.
//
// This drifted once already: preferences moved to sessionStorage under a new key while the inline
// script kept reading the old localStorage one, so it silently resolved every visitor to "system".
// The theme still applied once Vue booted, which is exactly why no other test caught it.
//
// Read the source, not the built `toolbox/www/toolbox.html`: that file is gitignored, so it is
// absent on a fresh clone and this test would pass by reading nothing.
const html = readFileSync(path.resolve(import.meta.dirname, '../../index.html'), 'utf8')

describe('the pre-paint theme bootstrap in frontend/index.html', () => {
  it('reads the key the store actually writes the theme to', () => {
    expect(html).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`)
  })

  it('does not read the preference blob, which no longer lives in localStorage', () => {
    expect(html).not.toContain(`localStorage.getItem('${PREFERENCES_STORAGE_KEY}')`)
  })

  it('still falls back to the system colour scheme', () => {
    expect(html).toContain('prefers-color-scheme: dark')
  })
})
