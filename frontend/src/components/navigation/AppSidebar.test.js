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
    const expanded = await mountSidebar({ collapsed: false })
    // frappe-ui's SidebarCollapseToggle names itself for what the click will do, and Sidebar owns
    // the state, so the toggle reports through the model rather than an event of our own.
    const toggle = expanded.get('button[aria-label="Collapse"]')

    // The panel icon, turned around when collapsed. Two chevrons were a different control from
    // the rest of Frappe. Read before the click, because the toggle collapses this sidebar.
    expect(toggle.find('.lucide-panel-right-open').exists()).toBe(true)
    expect(toggle.find('.rotate-180').exists()).toBe(false)

    await toggle.trigger('click')
    expect(expanded.emitted('update:collapsed')).toEqual([[true]])

    const collapsed = await mountSidebar({ collapsed: true })
    // Section headings collapse to dividers, and tool links fall back to icon + aria-label.
    expect(collapsed.findAll('h2')).toHaveLength(0)
    const collapsedToggle = collapsed.get('button[aria-label="Expand"]')
    expect(collapsedToggle.find('.lucide-panel-right-open.rotate-180').exists()).toBe(true)
    const calculator = toolsById.get('calculator')
    expect(collapsed.get(`a[href="${calculator.route}"]`).attributes('aria-label')).toBe(
      calculator.name,
    )
  })

  // Sidebar resolves its own state as `(model ?? isMobile)`. The copy inside the mobile sheet sets
  // no model, so without `disable-collapse` it would collapse itself to an icon rail on the phone
  // it was opened on, and the sheet would show a strip of unlabelled icons.
  it('stays open below the mobile breakpoint when collapsing is disabled', async () => {
    const width = globalThis.innerWidth
    globalThis.innerWidth = 375

    try {
      const pinned = await mountSidebar({ disableCollapse: true, showBrand: false })
      expect(pinned.get('[data-slot="sidebar"]').attributes('data-state')).toBe('expanded')
      expect(pinned.findAll('h2').length).toBeGreaterThan(0)
      expect(pinned.find('button[aria-label="Collapse"]').exists()).toBe(false)

      const unpinned = await mountSidebar()
      expect(unpinned.get('[data-slot="sidebar"]').attributes('data-state')).toBe('collapsed')
    } finally {
      globalThis.innerWidth = width
    }
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
