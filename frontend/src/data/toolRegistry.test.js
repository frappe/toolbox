import { describe, expect, it } from 'vitest'

import {
  getCategory,
  getToolsByCategory,
  isToolAvailable,
  toolCategories,
  tools,
  toolsById,
} from './toolRegistry'

const offlineCapabilities = new Set(['full', 'partial', 'cached', 'server-dataset', 'none'])
const releaseStatuses = new Set(['available', 'dependency-validation'])
const externalDependencyStatuses = new Set([
  'none',
  'provider-required',
  'india-compliance-required',
  'datasets-required',
  'dataset-required',
])

describe('tool registry', () => {
  it('keeps every summary short enough to read without being cut', () => {
    // All Tools and the search dialog truncate this line, and the narrowest place it lands is the
    // three-column desktop grid: 245px of text at 12px, which is about 33 characters. Every
    // description was longer, so almost every row ended in an ellipsis. The budget is 32, and it
    // is a test rather than a note because the only symptom of breaking it is a cut word.
    const BUDGET = 32

    for (const tool of tools) {
      expect(tool.summary, tool.id).toBeTruthy()
      expect(tool.summary.length, `${tool.id}: "${tool.summary}"`).toBeLessThanOrEqual(BUDGET)
      // A summary is a phrase, not a sentence, so it carries no closing full stop.
      expect(tool.summary.endsWith('.'), tool.id).toBe(false)
    }

    // The two say different things in different places, so neither may stand in for the other.
    expect(new Set(tools.map((tool) => tool.summary)).size).toBe(tools.length)
  })

  it('defines every V1 tool with a complete and valid schema', () => {
    const categoryIds = new Set(toolCategories.map((category) => category.id))

    expect(tools).toHaveLength(33)
    expect(new Set(tools.map((tool) => tool.id)).size).toBe(tools.length)
    expect(new Set(tools.map((tool) => tool.route)).size).toBe(tools.length)

    for (const tool of tools) {
      expect(tool.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.icon).toMatch(/^lucide-/)
      expect(categoryIds.has(tool.category)).toBe(true)
      expect(tool.route).toBe(`/${tool.id}`)
      expect(offlineCapabilities.has(tool.offlineCapability)).toBe(true)
      expect(releaseStatuses.has(tool.releaseStatus)).toBe(true)
      expect(externalDependencyStatuses.has(tool.externalDependencyStatus)).toBe(true)
      expect(Array.isArray(tool.searchKeywords)).toBe(true)
      expect(Object.isFrozen(tool)).toBe(true)
    }
  })

  it('gives every tool in a family its own variant of the shared view', () => {
    const families = new Map()
    for (const tool of tools) {
      if (!tool.family) {
        // A tool outside a family renders its own view, so a variant would name nothing.
        expect(tool.variant).toBeNull()
        continue
      }
      expect(tool.variant).toBeTruthy()
      families.set(tool.family, [...(families.get(tool.family) ?? []), tool.variant])
    }

    expect(new Set(families.keys())).toEqual(new Set([
        'timer',
        'india-business-lookup',
        'health-calculators',
        'financial-calculators',
        'unit-converter',
      ]))
    for (const [family, variants] of families) {
      // Two tools sharing a variant would render the same page at two URLs, which is the
      // duplicate content the split exists to avoid.
      expect(new Set(variants).size, family).toBe(variants.length)
    }
  })

  it('marks dependency-validation tools with a flag and external dependency', () => {
    const conditionalTools = tools.filter((tool) => !isToolAvailable(tool))

    expect(conditionalTools).toHaveLength(0)
    for (const tool of conditionalTools) {
      expect(tool.featureFlag).toBeTruthy()
      expect(tool.externalDependencyStatus).not.toBe('none')
    }
  })

  it('indexes tools and categories without stale references', () => {
    for (const category of toolCategories) {
      expect(getCategory(category.id)).toEqual(category)
      expect(getToolsByCategory(category.id).length).toBeGreaterThan(0)
    }

    for (const tool of tools) {
      expect(toolsById.get(tool.id)).toBe(tool)
    }
  })
})
