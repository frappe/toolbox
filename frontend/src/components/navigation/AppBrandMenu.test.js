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

  it('offers Settings', async () => {
    const wrapper = mountMenu()
    await wrapper.get('button[aria-label="Toolbox menu"]').trigger('click')

    expect(wrapper.get('a[href="/settings"]').text()).toContain('Settings')
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

  it('closes when a menu item is chosen', async () => {
    const wrapper = mountMenu()
    await wrapper.get('button[aria-label="Toolbox menu"]').trigger('click')
    await wrapper.get('a[href="/settings"]').trigger('click')

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(wrapper.emitted('navigate')).toHaveLength(1)
  })
})
