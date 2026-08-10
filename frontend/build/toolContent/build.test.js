import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { tools } from '../../src/data/toolRegistry.js'
import { PAGES_DIRECTORY, buildPage, slugOf } from './build.js'

const routes = tools.map((tool) => tool.route)

function committedPage(route) {
  const file = path.join(PAGES_DIRECTORY, `${slugOf(route)}.json`)
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

describe('the committed page files', () => {
  it('cover every tool the registry serves', () => {
    // A missing file is a page that answers a crawler with an empty body, and nothing else fails.
    for (const route of routes) {
      expect(() => committedPage(route), `no page file for ${route}`).not.toThrow()
    }
  })

  it('serve no route the registry does not', () => {
    const expected = routes.map((route) => `${slugOf(route)}.json`)
    const files = fs.readdirSync(PAGES_DIRECTORY).filter((file) => file.endsWith('.json'))

    expect(files.sort()).toEqual(expected.sort())
  })

  it('match what the Markdown renders today', () => {
    // The files are committed so that a fresh clone, the Python tests and a deployment all read
    // real content. This is what stops an edit to a Markdown file that was never rebuilt.
    for (const tool of tools) {
      expect(committedPage(tool.route), `${tool.route} is out of date, run yarn build`).toEqual(
        buildPage(tool, routes),
      )
    }
  })

  it('carry a heading for every tool, whether its content is written or not', () => {
    for (const tool of tools) {
      // "HSN & SAC Lookup" reaches the page escaped, which is why this compares escaped text.
      const name = tool.name.replaceAll('&', '&amp;')
      expect(committedPage(tool.route).header).toContain(`>${name}</h1>`)
    }
  })
})

describe('a page that has content', () => {
  const page = committedPage('/emi-calculator')

  it('carries the questions and the steps that JSON-LD needs', () => {
    expect(page.faqs.length).toBeGreaterThan(3)
    expect(page.steps.length).toBeGreaterThan(0)
    for (const faq of page.faqs) {
      expect(faq.question).toMatch(/\?$/)
      expect(faq.answer.length).toBeGreaterThan(20)
    }
  })

  it('renders its content into the same HTML the client shows', () => {
    expect(page.content).toContain('>Frequently asked questions</h2>')
  })
})
