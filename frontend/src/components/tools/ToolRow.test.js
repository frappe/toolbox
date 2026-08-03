import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { toolsById } from '@/data/toolRegistry'
import ToolRow from './ToolRow.vue'

const preferences = useToolboxPreferences()

describe('ToolRow', () => {
  beforeEach(() => {
    preferences.favouriteIds.value = []
  })

  it('renders a focusable tool link with a visible-focus contract', async () => {
    const wrapper = await mountRow('calculator')
    const link = wrapper.get('a')

    expect(link.attributes('href')).toBe('/calculator')
    expect(link.classes()).toContain('focus-visible:ring-2')

    link.element.focus()
    expect(document.activeElement).toBe(link.element)
  })

  it('exposes favourite state and toggles it accessibly', async () => {
    const wrapper = await mountRow('calculator')
    const addButton = wrapper.get('button')

    expect(addButton.attributes('aria-label')).toBe('Add Calculator to favourites')
    expect(addButton.attributes('aria-pressed')).toBe('false')

    await addButton.trigger('click')
    const removeButton = wrapper.get('button')

    expect(preferences.isFavourite('calculator')).toBe(true)
    expect(removeButton.attributes('aria-label')).toBe('Remove Calculator from favourites')
    expect(removeButton.attributes('aria-pressed')).toBe('true')
    expect(removeButton.attributes('data-variant')).toBe('subtle')
  })

  it('labels tools that are still undergoing dependency validation', async () => {
    const validating = { ...toolsById.get('calculator'), id: 'demo-validating', name: 'Demo tool', releaseStatus: 'dependency-validation' }
    const wrapper = await mountRow(validating)

    expect(wrapper.text()).toContain('Demo tool')
    expect(wrapper.text()).toContain('Validating')
  })
})

async function mountRow(toolId) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/')
  await router.isReady()
  return mount(ToolRow, {
    props: { tool: typeof toolId === 'string' ? toolsById.get(toolId) : toolId },
    attachTo: document.body,
    global: { plugins: [router] },
  })
}
