import { describe, expect, it } from 'vitest'

import {
  getCategory,
  getFamily,
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
  it('defines every V1 tool with a complete and valid schema', () => {
    const categoryIds = new Set(toolCategories.map((category) => category.id))

    expect(tools).toHaveLength(34)
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

  it('groups a family through getFamily in registry order', () => {
    expect(getFamily('timer').map((tool) => tool.id)).toEqual([
      'timer',
      'stopwatch',
      'countdown-timer',
    ])
    expect(getFamily('not-a-family')).toEqual([])
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
