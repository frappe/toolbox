import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import AppBrandMenu from './AppBrandMenu.vue'

function mountMenu(props = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/settings', component: { template: '<div />' } },
    ],
  })
  return mount(AppBrandMenu, { props, global: { plugins: [router] }, attachTo: document.body })
}

describe('AppBrandMenu', () => {
  it('stays closed until the trigger is clicked', async () => {
    const wrapper = mountMenu()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    const trigger = wrapper.get('button[aria-label="Toolbox menu"]')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await trigger.trigger('click')

    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
    expect(trigger.attributes('aria-expanded')).toBe('true')
  })

  // The rows are `role="menuitem"` buttons rather than anchors. frappe-ui's Menu pushes
  // `option.route` through the router itself and renders no `<a href>`, so a middle click no
  // longer opens these three in a new tab. The 33 tool links in the sidebar are unaffected —
  // `SidebarItem` renders a real RouterLink — and both prose routes are in the sitemap, so
  // nothing about how they are reached or crawled changes.
  it('offers Settings', async () => {
    const wrapper = mountMenu()
    await wrapper.get('button[aria-label="Toolbox menu"]').trigger('click')

    const settings = wrapper.findAll('[role="menuitem"]').find((item) => item.text().includes('Settings'))
    expect(settings).toBeTruthy()
  })

  // Toolbox has no accounts. Nothing in the menu may offer one, ask for one, or imply that a
  // visitor is signed in as somebody.
  it('offers no account, sign-in or sign-out', async () => {
    const wrapper = mountMenu()
    await wrapper.get('button[aria-label="Toolbox menu"]').trigger('click')

    const text = wrapper.text()
    expect(text).toContain('no account')
    expect(text).not.toContain('Sign in')
    expect(text).not.toContain('Log out')
    expect(text).not.toContain('Not signed in')
    expect(wrapper.find('a[href^="/login"]').exists()).toBe(false)
  })

  it('navigates, closes and reports it when a menu item is chosen', async () => {
    const wrapper = mountMenu()
    await wrapper.get('button[aria-label="Toolbox menu"]').trigger('click')
    const settings = wrapper.findAll('[role="menuitem"]').find((item) => item.text().includes('Settings'))
    await settings.trigger('click')

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    // The mobile shell closes its sheet on this, so a menu that navigates without reporting
    // leaves the sheet covering the page it just opened.
    expect(wrapper.emitted('navigate')).toHaveLength(1)
  })
})
