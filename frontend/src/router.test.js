import { describe, expect, it } from 'vitest'

import { tools } from '@/data/toolRegistry'
import router from './router'

describe('generated routes', () => {
  it('creates one route with stable metadata for every registered tool', () => {
    const routes = router.getRoutes()

    for (const tool of tools) {
      const route = routes.find((candidate) => candidate.name === `Tool:${tool.id}`)

      expect(route?.path).toBe(tool.route)
      expect(route?.meta).toEqual({ toolId: tool.id })
      expect(route?.components.default).toEqual(expect.any(Function))
    }
  })

  it('keeps the static routes and sends unknown paths to All Tools', () => {
    const routes = router.getRoutes()

    expect(routes.find((route) => route.path === '/')?.redirect).toBe('/all-tools')
    expect(routes.find((route) => route.name === 'AllTools')?.path).toBe('/all-tools')
    expect(routes.find((route) => route.name === 'Settings')?.path).toBe('/settings')
    expect(routes.find((route) => route.path === '/:pathMatch(.*)*')?.redirect).toBe('/all-tools')
  })

  it('uses unique names and paths across all resolved routes', () => {
    const routes = router.getRoutes()
    const names = routes.map((route) => route.name).filter(Boolean)
    const paths = routes.map((route) => route.path)

    expect(new Set(names).size).toBe(names.length)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it.each([
    ['calculator', 'CalculatorView'],
    ['financial-calculators', 'FinancialCalculatorsView'],
    ['gst-calculator', 'GstCalculatorView'],
    ['hsn-sac-lookup', 'HsnSacLookupView'],
    ['india-business-lookup', 'IndiaBusinessLookupView'],
    ['unit-converter', 'UnitConverterView'],
    ['world-clock', 'WorldClockView'],
  ])('loads the implemented %s view', async (toolId, componentName) => {
    const route = router.getRoutes().find((candidate) => candidate.name === `Tool:${toolId}`)
    const componentModule = await route.components.default()

    expect(componentModule.default.__name).toBe(componentName)
  })
})
