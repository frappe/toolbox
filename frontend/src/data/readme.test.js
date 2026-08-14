import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { getToolsByCategory, toolCategories, tools } from './toolRegistry'

// The README lists every tool by category. That list went stale once already: it still offered
// Weather months after the tool was deleted, and never gained the nine routes the tab split
// created. Nothing pointed at it, because a README is not imported by anything.
const README_PATH = path.resolve(import.meta.dirname, '../../../README.md')

/** Read the rows of the tools table as `{ category, count, names }`. */
function readToolRows() {
  const rows = fs.readFileSync(README_PATH, 'utf8').matchAll(/^\|\s*\*\*(.+?)\*\*\s*\((\d+)\)\s*\|(.+?)\|$/gm)
  return [...rows].map(([, category, count, names]) => ({
    category,
    count: Number(count),
    names: names.split('·').map((name) => name.trim()),
  }))
}

describe('the README tool table', () => {
  const rows = readToolRows()

  it('lists every category the registry defines, in the registry order', () => {
    expect(rows.map((row) => row.category)).toEqual(toolCategories.map((category) => category.name))
  })

  it('names every tool in each category, and no others', () => {
    for (const row of rows) {
      const category = toolCategories.find(({ name }) => name === row.category)
      const registered = getToolsByCategory(category.id).map((tool) => tool.name)
      expect(row.names, `the ${row.category} row`).toEqual(registered)
    }
  })

  it('states a count that matches the tools it lists', () => {
    for (const row of rows) {
      expect(row.count, `the ${row.category} count`).toBe(row.names.length)
    }
  })

  it('states the total the registry holds', () => {
    const readme = fs.readFileSync(README_PATH, 'utf8')
    expect(readme).toContain(`Toolbox has ${tools.length} tools in seven categories`)
    // The offline claim is a count too, and it is the one a reader checks against the tool list.
    const offline = tools.filter((tool) => tool.offlineCapability === 'full')
    expect(readme).toContain(`Then ${offline.length} of the ${tools.length} tools work`)
  })
})
