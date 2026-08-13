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

  it('gives a tool outside a family no variant', () => {
    const { variant } = familyFor('calculator')

    expect(variant.value).toBeNull()
  })

  it('survives a route that names no tool', () => {
    const { tool, variant } = familyFor(undefined)

    expect(tool.value).toBeUndefined()
    expect(variant.value).toBeNull()
  })

  it('offers the siblings nowhere, because the sidebar is the only tool list', () => {
    // A page used to carry a strip of links to the rest of its family, which listed the same
    // tools the sidebar already lists. Removing it is the point of this contract.
    expect(Object.keys(familyFor('timer'))).toEqual(['tool', 'variant'])
  })
})
