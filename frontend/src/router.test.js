import { describe, expect, it } from 'vitest'

import { tools } from '@/data/toolRegistry'
import router from './router'

describe('generated routes', () => {
  it('creates one route with stable metadata for every registered tool', () => {
    const routes = router.getRoutes()

    for (const tool of tools) {
      const route = routes.find((candidate) => candidate.name === `Tool:${tool.id}`)

      expect(route?.path).toBe(tool.route)
      // The variant tells a shared view which of its tools it is rendering. It is null for a
      // tool that has a view to itself.
      expect(route?.meta).toEqual({ toolId: tool.id, variant: tool.variant })
      expect(route?.components.default).toEqual(expect.any(Function))
    }
  })

  it('has a registered view for every family in the registry', () => {
    // The router throws while it builds its routes when a family has no view, so importing it
    // at all is the assertion. This test states the contract that import relies on.
    const families = new Set(tools.map((tool) => tool.family).filter(Boolean))

    for (const family of families) {
      const routed = tools.filter((tool) => tool.family === family)
      for (const tool of routed) {
        const route = router.getRoutes().find((candidate) => candidate.name === `Tool:${tool.id}`)
        expect(route?.components.default, tool.id).toEqual(expect.any(Function))
      }
    }
  })

  it('points every tool in a family at the one view they share', async () => {
    const timekeeping = ['timer', 'stopwatch', 'countdown-timer']

    for (const toolId of timekeeping) {
      const route = router.getRoutes().find((candidate) => candidate.name === `Tool:${toolId}`)
      const componentModule = await route.components.default()

      expect(componentModule.default.__name, toolId).toBe('TimerView')
    }
  })

  it('keeps the static routes and sends unknown paths to All Tools', () => {
    const routes = router.getRoutes()

    expect(routes.find((route) => route.path === '/')?.name).toBe('AllTools')
    expect(routes.find((route) => route.path === '/all-tools')?.redirect).toBe('/')
    expect(routes.find((route) => route.name === 'Settings')?.path).toBe('/settings')
    expect(routes.find((route) => route.path === '/:pathMatch(.*)*')?.redirect).toBe('/')
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
    ['unit-converter', 'UnitConverterView'],
    ['world-clock', 'WorldClockView'],
  ])('loads the implemented %s view', async (toolId, componentName) => {
    const route = router.getRoutes().find((candidate) => candidate.name === `Tool:${toolId}`)
    const componentModule = await route.components.default()

    expect(componentModule.default.__name).toBe(componentName)
  })
})
