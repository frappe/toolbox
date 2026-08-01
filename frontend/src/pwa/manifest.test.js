import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const MANIFEST_PATH = path.resolve(
  import.meta.dirname,
  '../../../toolbox/public/pwa/manifest.webmanifest',
)

describe('Toolbox web manifest', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))

  it('keeps installation inside the Toolbox route', () => {
    expect(manifest.id).toBe('/toolbox/')
    expect(manifest.start_url).toBe('/toolbox/all-tools')
    expect(manifest.scope).toBe('/toolbox/')
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
