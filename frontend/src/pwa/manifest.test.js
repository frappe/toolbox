import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const MANIFEST_PATH = path.resolve(
  import.meta.dirname,
  '../../../toolbox/public/pwa/manifest.webmanifest',
)

describe('Toolbox web manifest', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))

  // Toolbox owns the whole site, so an installed copy owns the whole origin.
  it('installs at the site root', () => {
    expect(manifest.id).toBe('/')
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
  })

  it('provides standard and maskable application icons', () => {
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
        expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
        expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
      ]),
    )
  })
})
