import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import AppShell from './AppShell.vue'

const AppSidebarStub = defineComponent({
  name: 'AppSidebar',
  emits: ['navigate', 'search'],
  template: `
    <aside>
      <button data-test="sidebar-search" @click="$emit('search')">Sidebar search</button>
      <button data-test="sidebar-navigate" @click="$emit('navigate')">Navigate</button>
    </aside>
  `,
})

const ToolSearchDialogStub = defineComponent({
  name: 'ToolSearchDialog',
  props: {
    modelValue: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  template: '<div data-test="tool-search" :data-open="String(modelValue)" />',
})

describe('AppShell', () => {
  it.each([
    ['Meta', { metaKey: true }],
    ['Control', { ctrlKey: true }],
  ])('opens search with the %s+K shortcut', async (_, modifier) => {
    const wrapper = await mountShell()
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      cancelable: true,
      ...modifier,
    })

    window.dispatchEvent(event)
    await nextTick()

    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.get('[data-test="tool-search"]').attributes('data-open')).toBe('true')
  })

  it('does not steal the shortcut while the user is typing', async () => {
    const wrapper = await mountShell()
    const input = wrapper.get('[data-test="typing"]')
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })

    input.element.dispatchEvent(event)
    await nextTick()

    expect(event.defaultPrevented).toBe(false)
    expect(wrapper.get('[data-test="tool-search"]').attributes('data-open')).toBe('false')
  })

  it('opens search from the mobile header and bottom navigation', async () => {
    const wrapper = await mountShell()

    await wrapper.get('button[aria-label="Search tools"]').trigger('click')
    expect(wrapper.get('[data-test="tool-search"]').attributes('data-open')).toBe('true')

    wrapper.getComponent(ToolSearchDialogStub).vm.$emit('update:modelValue', false)
    await nextTick()
    const bottomSearch = wrapper.findAll('nav[aria-label="Primary mobile navigation"] button')[0]
    await bottomSearch.trigger('click')
    expect(wrapper.get('[data-test="tool-search"]').attributes('data-open')).toBe('true')
  })

  it('opens and closes the mobile navigation sheet', async () => {
    const wrapper = await mountShell()

    await wrapper.get('button[aria-label="Open navigation"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('Navigate')
    expect(wrapper.get('button[aria-label="Open navigation"]').attributes('aria-expanded')).toBe(
      'true',
    )

    await wrapper.get('[role="dialog"] [data-test="sidebar-navigate"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })
})

async function mountShell() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/all-tools', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()

  return mount(AppShell, {
    slots: { default: '<input data-test="typing" />' },
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: {
        AppSidebar: AppSidebarStub,
        ToolSearchDialog: ToolSearchDialogStub,
      },
    },
  })
}
