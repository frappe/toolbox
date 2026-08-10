import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { useToolFamily } from './useToolFamily'

const route = { meta: {}, path: '/timer' }
vi.mock('vue-router', () => ({ useRoute: () => route }))

function familyFor(toolId) {
  route.meta = { toolId }
  let family
  mount(
    defineComponent({
      setup() {
        family = useToolFamily()
        return () => null
      },
    }),
  )
  return family
}

describe('useToolFamily', () => {
  it('names which tool of the family the route is asking for', () => {
    const { tool, variant } = familyFor('stopwatch')

    expect(tool.value.name).toBe('Stopwatch')
    expect(variant.value).toBe('stopwatch')
  })

  it('lists the siblings as real links, so a crawler can follow them', () => {
    const { siblingLinks } = familyFor('timer')

    expect(siblingLinks.value).toEqual([
      { label: 'Timer', value: 'timer', route: '/timer' },
      { label: 'Stopwatch', value: 'stopwatch', route: '/stopwatch' },
      { label: 'Countdown Timer', value: 'countdown', route: '/countdown-timer' },
    ])
  })

  it('gives a tool outside a family no siblings and no variant', () => {
    const { variant, siblingLinks } = familyFor('calculator')

    expect(variant.value).toBeNull()
    expect(siblingLinks.value).toEqual([])
  })

  it('survives a route that names no tool', () => {
    const { tool, variant, siblingLinks } = familyFor(undefined)

    expect(tool.value).toBeUndefined()
    expect(variant.value).toBeNull()
    expect(siblingLinks.value).toEqual([])
  })
})

describe('currentRoute', () => {
  it('reports the path, which is what marks a link as the page you are on', () => {
    route.path = '/stopwatch'
    const { currentRoute } = familyFor('stopwatch')

    expect(currentRoute.value).toBe('/stopwatch')
  })
})
