import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { PROSE_PAGE_WIDTH, TOOL_PAGE_WIDTH, pageWidthFor } from './pageLayout'

const VIEWS = path.resolve(import.meta.dirname, '../views')
const PROSE_VIEWS = new Set(['AboutView.vue', 'DataSourcesView.vue', 'SettingsView.vue'])

function viewFiles() {
  const vue = (file) => file.endsWith('.vue')
  return [
    ...fs.readdirSync(path.join(VIEWS, 'tools')).filter(vue).map((file) => ['tools', file]),
    ...fs.readdirSync(VIEWS).filter(vue).map((file) => ['', file]),
  ]
}

function containerWidth(segment, file) {
  const source = fs.readFileSync(path.join(VIEWS, segment, file), 'utf8')
  // The page container is the first `mx-auto ... w-full max-w-*` in the template.
  return source.match(/mx-auto[^"]*w-full\s+(max-w-[0-9a-z]+)/)?.[1] ?? null
}

describe('page width', () => {
  // Each view used to pick its own width, from `max-w-3xl` to `max-w-6xl`. Two tools next to each
  // other in the sidebar then started at different left edges, and the content below every one of
  // them sat in a narrower band than the tool it explained (#274). A literal class is written in
  // each view so Tailwind generates it; this is what keeps the literals honest.
  it.each(viewFiles().filter(([, file]) => !PROSE_VIEWS.has(file)))(
    '%s/%s uses the one tool-page width',
    (segment, file) => {
      expect(containerWidth(segment, file)).toBe(TOOL_PAGE_WIDTH)
    },
  )

  it.each([...PROSE_VIEWS].filter((file) => file !== 'SettingsView.vue'))(
    '%s keeps a reading measure',
    (file) => {
      expect(containerWidth('', file)).toBe(PROSE_PAGE_WIDTH)
    },
  )

  // `renderContent` writes the wrapper the content sits in, and it has to be the width of the page
  // above it. Getting this pair wrong is invisible to every other test: the words are all there,
  // they are just in the wrong lane.
  it('gives a tool route the tool width and a prose route the reading measure', () => {
    expect(pageWidthFor('/calculator')).toBe(TOOL_PAGE_WIDTH)
    expect(pageWidthFor('/time-zone-converter')).toBe(TOOL_PAGE_WIDTH)
    expect(pageWidthFor('/about')).toBe(PROSE_PAGE_WIDTH)
    expect(pageWidthFor('/data-sources')).toBe(PROSE_PAGE_WIDTH)
  })
})
