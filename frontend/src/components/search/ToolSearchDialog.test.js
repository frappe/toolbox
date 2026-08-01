import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import { isToolAvailable, tools } from '@/data/toolRegistry'
import ToolSearchDialog from './ToolSearchDialog.vue'

describe('ToolSearchDialog', () => {
  it('lists only tools that are ready for use', async () => {
    const wrapper = await mountDialog()
    const availableTools = tools.filter(isToolAvailable)

    expect(wrapper.findAll('button')).toHaveLength(availableTools.length)
    for (const tool of availableTools) expect(wrapper.text()).toContain(tool.name)
    for (const tool of tools.filter((tool) => !isToolAvailable(tool))) {
      expect(wrapper.text()).not.toContain(tool.name)
    }
  })

  it('filters by search terms and shows an empty state', async () => {
    const wrapper = await mountDialog()
    const input = wrapper.get('input[aria-label="Search tools"]')

    await input.setValue('math')
    expect(wrapper.text()).toContain('Calculator')
    expect(wrapper.findAll('button')).toHaveLength(1)

    await input.setValue('not a toolbox query')
    expect(wrapper.text()).toContain('No matching tools')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('closes and navigates after selecting a result', async () => {
    const router = await makeRouter()
    const wrapper = mount(ToolSearchDialog, {
      props: { modelValue: true },
      global: { plugins: [router] },
    })

    await wrapper.get('input[aria-label="Search tools"]').setValue('math')
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
    expect(router.currentRoute.value.path).toBe('/calculator')
  })

  it('focuses search when opened and clears the previous query when closed', async () => {
    const router = await makeRouter()
    const wrapper = mount(ToolSearchDialog, {
      props: { modelValue: false },
      attachTo: document.body,
      global: { plugins: [router] },
    })

    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    const input = wrapper.get('input[aria-label="Search tools"]')
    expect(document.activeElement).toBe(input.element)

    await input.setValue('math')
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    expect(wrapper.get('input[aria-label="Search tools"]').element.value).toBe('')
  })
})

async function mountDialog() {
  const router = await makeRouter()
  return mount(ToolSearchDialog, {
    props: { modelValue: true },
    global: { plugins: [router] },
  })
}

async function makeRouter() {
  const component = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component },
      ...tools.map((tool) => ({ path: tool.route, component })),
    ],
  })
  await router.push('/')
  await router.isReady()
  return router
}
