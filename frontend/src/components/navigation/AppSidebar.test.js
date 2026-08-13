import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import { getToolsByCategory, toolCategories, tools, toolsById } from '@/data/toolRegistry'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import AppSidebar from './AppSidebar.vue'

describe('AppSidebar', () => {
  it('lists every category with its count, and omits the Recent section', async () => {
    const wrapper = await mountSidebar()
    const headings = wrapper.findAll('h2').map((heading) => heading.text())

    expect(headings).toEqual(
      toolCategories.map((category) => `${category.name}${getToolsByCategory(category.id).length}`),
    )
    expect(headings.join(' ')).not.toContain('Recent')

    // Every tool is reachable from the sidebar. A closed category hides its links rather than
    // dropping them, so the visitor keeps one link per tool either way.
    for (const tool of tools) {
      const links = wrapper.findAll(`a[href="${tool.route}"]`)
      expect(links).toHaveLength(1)
      expect(links[0].text()).toContain(tool.name)
    }
  })

  it('opens the category holding the tool being used, and keeps the rest closed', async () => {
    // Thirty-four tools listed at once is a scroll rather than a navigation.
    const wrapper = await mountSidebar({}, '/bmi-calculator')

    expect(sectionState(wrapper, 'Health')).toBe('true')
    expect(sectionState(wrapper, 'Convert')).toBe('false')
    expect(wrapper.get('a[href="/bmi-calculator"]').isVisible()).toBe(true)
    expect(wrapper.get('a[href="/length-converter"]').isVisible()).toBe(false)
  })

  it('opens and closes a category from its heading', async () => {
    const wrapper = await mountSidebar({}, '/bmi-calculator')

    await sectionToggle(wrapper, 'Convert').trigger('click')
    expect(sectionState(wrapper, 'Convert')).toBe('true')
    expect(wrapper.get('a[href="/length-converter"]').isVisible()).toBe(true)

    await sectionToggle(wrapper, 'Health').trigger('click')
    expect(sectionState(wrapper, 'Health')).toBe('false')
    expect(wrapper.get('a[href="/bmi-calculator"]').isVisible()).toBe(false)
  })

  it('names the panel each heading controls', async () => {
    const wrapper = await mountSidebar({}, '/bmi-calculator')
    const toggle = sectionToggle(wrapper, 'Health')

    expect(wrapper.get(`#${toggle.attributes('aria-controls')}`).exists()).toBe(true)
  })

  it('exposes a collapse toggle and hides labels when collapsed', async () => {
    const expanded = await mountSidebar({ collapsible: true, collapsed: false })
    const toggle = expanded.get('button[aria-label="Collapse sidebar"]')
    await toggle.trigger('click')
    expect(expanded.emitted('toggle-collapse')).toHaveLength(1)

    const collapsed = await mountSidebar({ collapsible: true, collapsed: true })
    // Section headings collapse to dividers, and tool links fall back to icon + aria-label.
    expect(collapsed.findAll('h2')).toHaveLength(0)
    expect(collapsed.get('button[aria-label="Expand sidebar"]').exists()).toBe(true)
    const calculator = toolsById.get('calculator')
    expect(collapsed.get(`a[href="${calculator.route}"]`).attributes('aria-label')).toBe(
      calculator.name,
    )
  })

  it('omits tools the user has hidden', async () => {
    const preferences = useToolboxPreferences()
    const dictionary = toolsById.get('dictionary')
    preferences.toggleHidden('dictionary')

    try {
      const wrapper = await mountSidebar()
      expect(wrapper.findAll(`a[href="${dictionary.route}"]`)).toHaveLength(0)
      expect(wrapper.findAll(`a[href="${toolsById.get('calculator').route}"]`).length).toBeGreaterThan(0)
    } finally {
      preferences.toggleHidden('dictionary')
    }
  })
})

function sectionToggle(wrapper, label) {
  return wrapper
    .findAll('h2 button')
    .find((button) => button.text().startsWith(label))
}

function sectionState(wrapper, label) {
  return sectionToggle(wrapper, label).attributes('aria-expanded')
}

async function mountSidebar(props = {}, path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/all-tools', component: { template: '<div />' } },
      { path: '/settings', component: { template: '<div />' } },
      ...tools.map((tool) => ({
        path: tool.route,
        component: { template: '<div />' },
        meta: { toolId: tool.id },
      })),
    ],
  })
  await router.push(path)
  await router.isReady()

  return mount(AppSidebar, { props, global: { plugins: [router] } })
}
