import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { SERVER_META_END, SERVER_META_START, injectServerMeta } from './pwaBuildPlugin.js'

// The build output is gitignored, so a test that reads toolbox/www/toolbox.html passes by
// reading nothing on a fresh clone. These read the two files that are committed instead.
const indexHtml = readFileSync(path.resolve(import.meta.dirname, '../index.html'), 'utf8')
const metaBlock = readFileSync(
  path.resolve(import.meta.dirname, 'server-meta.template.html'),
  'utf8',
)

describe('the server metadata block', () => {
  it('replaces the static fallback in the page Frappe renders', () => {
    const built = injectServerMeta(indexHtml, metaBlock)

    expect(built).toContain('<title>{{ seo.title | e }}</title>')
    expect(built).toContain('{{ seo.canonical | e }}')
    expect(built).not.toContain(SERVER_META_START)
    expect(built).not.toContain(SERVER_META_END)
  })

  it('leaves exactly one title', () => {
    const built = injectServerMeta(indexHtml, metaBlock)

    expect(built.match(/<title>/g)).toHaveLength(1)
  })

  it('refuses to build a page it could not put metadata into', () => {
    // Returning the HTML unchanged would ship a site whose every page claims the same title,
    // which is the exact failure this block exists to fix, and nothing else would notice.
    expect(() => injectServerMeta('<html><head></head></html>', metaBlock)).toThrow(
      /markers are missing/,
    )
  })

  it('keeps a readable title in the copy the service worker caches offline', () => {
    // The same HTML is published as an asset and cached as the offline shell, where Jinja never
    // runs. `{{ seo.title }}` there would be the visitor's tab title.
    expect(indexHtml).toContain('<title>Toolbox</title>')
    expect(indexHtml).not.toContain('{{')
  })

  it('escapes every attribute, because Frappe does not autoescape', () => {
    const attributeValues = [...metaBlock.matchAll(/(?:content|href)="\{\{([^}]*)\}\}"/g)]

    expect(attributeValues.length).toBeGreaterThan(0)
    for (const [, expression] of attributeValues) {
      expect(expression).toMatch(/\|\s*e\s*$/)
    }
  })

  it('leaves the JSON-LD unescaped, because it is JSON and not markup', () => {
    expect(metaBlock).toContain('{{ seo.structured_data }}')
  })
})
