import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { SERVER_CONTENT_MARKERS, SERVER_META_MARKERS, injectBlock } from './pwaBuildPlugin.js'

// The build output is gitignored, so a test that reads toolbox/www/toolbox.html passes by
// reading nothing on a fresh clone. These read the files that are committed instead.
const indexHtml = readFileSync(path.resolve(import.meta.dirname, '../index.html'), 'utf8')
const read = (markers) => readFileSync(markers.templatePath, 'utf8')
const metaBlock = read(SERVER_META_MARKERS)
const contentBlock = read(SERVER_CONTENT_MARKERS)

function build() {
  let page = indexHtml
  for (const markers of [SERVER_META_MARKERS, SERVER_CONTENT_MARKERS]) {
    page = injectBlock(page, markers, read(markers))
  }
  return page
}

describe('the server metadata block', () => {
  it('replaces the static fallback in the page Frappe renders', () => {
    const built = injectBlock(indexHtml, SERVER_META_MARKERS, metaBlock)

    expect(built).toContain('<title>{{ seo.title | e }}</title>')
    expect(built).toContain('{{ seo.canonical | e }}')
    expect(built).not.toContain(SERVER_META_MARKERS.start)
    expect(built).not.toContain(SERVER_META_MARKERS.end)
  })

  it('leaves exactly one title', () => {
    expect(build().match(/<title>/g)).toHaveLength(1)
  })

  it('refuses to build a page it could not put metadata into', () => {
    // Returning the HTML unchanged would ship a site whose every page claims the same title,
    // which is the exact failure this block exists to fix, and nothing else would notice.
    expect(() => injectBlock('<html><head></head></html>', SERVER_META_MARKERS, metaBlock)).toThrow(
      /markers are missing/,
    )
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

describe('the server content block', () => {
  it('renders the heading and the content inside the element the application mounts on', () => {
    const built = build()
    const app = built.slice(built.indexOf('<div id="app"'), built.indexOf('</div>'))

    // Vue empties its mount container, so the block is replaced rather than repeated. Anywhere
    // else on the page it would still be there after the application boots.
    expect(app).toContain('{{ seo.name | e }}')
    expect(app).toContain('{{ seo.description | e }}')
    expect(built).toContain('{{ page_content.content }}')
    expect(built).not.toContain(SERVER_CONTENT_MARKERS.start)
  })

  it('gives every route a heading, and content only where there is content', () => {
    // The heading comes from seo.py, which names every route. Only a tool has content.
    expect(contentBlock).toContain('<h1')
    expect(contentBlock).toContain('{%- if page_content %}')
  })

  it('lists every tool at the root, and nowhere else', () => {
    expect(contentBlock).toContain('{%- if seo.tool_links %}')
    expect(contentBlock).toContain('href="{{ link.path | e }}"')
  })

  it('escapes every value, because Frappe does not autoescape', () => {
    const interpolations = [...contentBlock.matchAll(/\{\{([^}]*)\}\}/g)].map(([, value]) => value.trim())

    for (const value of interpolations) {
      // `page_content.content` is rendered HTML from the build, and is raw on purpose.
      if (value === 'page_content.content') continue
      expect(value, value).toMatch(/\|\s*e$/)
    }
  })

  it('refuses to build a page it could not put content into', () => {
    expect(() => injectBlock('<html><body></body></html>', SERVER_CONTENT_MARKERS, contentBlock)).toThrow(
      /markers are missing/,
    )
  })
})

describe('the copy the service worker caches offline', () => {
  it('keeps a readable title and no Jinja', () => {
    // The same HTML is published as an asset and cached as the offline shell, where Jinja never
    // runs. `{{ seo.title }}` there would be the visitor's tab title.
    expect(indexHtml).toContain('<title>Toolbox</title>')
    expect(indexHtml).not.toContain('{{')
  })

  it('leaves the mount element empty, so the application fills it', () => {
    const app = indexHtml.slice(indexHtml.indexOf('<div id="app"'), indexHtml.indexOf('</div>'))

    expect(app).not.toContain('page_content')
  })
})
