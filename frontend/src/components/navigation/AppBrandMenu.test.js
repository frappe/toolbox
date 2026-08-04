import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it } from 'vitest'

import { suiteApps } from '@/data/suiteApps'
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

afterEach(() => {
  delete globalThis.is_logged_in
  delete globalThis.user
  delete globalThis.full_name
})

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

  it('lists every Suite app and a Settings entry', async () => {
    const wrapper = mountMenu()
    await wrapper.get('button[aria-label="Toolbox menu"]').trigger('click')

    for (const app of suiteApps) {
      expect(wrapper.get(`a[href="${app.href}"]`).text()).toContain(app.name)
    }
    expect(wrapper.get('a[href="/settings"]').text()).toContain('Settings')
  })

  it('offers Sign in for guests', async () => {
    const wrapper = mountMenu()
    await wrapper.get('button[aria-label="Toolbox menu"]').trigger('click')

    expect(wrapper.text()).toContain('Not signed in')
    expect(wrapper.find('a[href="/login?redirect-to=/toolbox"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Log out')
  })

  it('shows the signed-in name and a Log out action', async () => {
    globalThis.is_logged_in = true
    globalThis.user = 'ada@example.com'
    globalThis.full_name = 'Ada Lovelace'

    const wrapper = mountMenu()
    await wrapper.get('button[aria-label="Toolbox menu"]').trigger('click')

    expect(wrapper.text()).toContain('Ada Lovelace')
    expect(wrapper.text()).toContain('ada@example.com')
    expect(wrapper.findAll('button').some((button) => button.text().includes('Log out'))).toBe(true)
  })

  it('closes when a menu item is chosen', async () => {
    const wrapper = mountMenu()
    await wrapper.get('button[aria-label="Toolbox menu"]').trigger('click')
    await wrapper.get('a[href="/settings"]').trigger('click')

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(wrapper.emitted('navigate')).toHaveLength(1)
  })
})
