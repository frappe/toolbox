import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

import AllToolsView from './AllToolsView.vue'

const ToolRowStub = defineComponent({
  name: 'ToolRow',
  props: {
    tool: { type: Object, required: true },
  },
  template: '<article data-tool-row>{{ tool.name }}</article>',
})

describe('AllToolsView', () => {
  it('gives the tool search a stable accessible name', async () => {
    const { wrapper } = await mountView()

    expect(wrapper.get('input[placeholder="Search all tools"]').attributes('aria-label')).toBe(
      'Search all tools',
    )
  })

  it('filters tools by text and renders the matching category group', async () => {
    const { wrapper } = await mountView()
    const search = wrapper.get('input[placeholder="Search all tools"]')

    await search.setValue('bmi')

    expect(toolNames(wrapper)).toEqual(['Health & Fitness Calculators'])
    expect(wrapper.text()).toContain('Calculate')
  })

  it('filters by category and keeps the selection in the URL', async () => {
    const { router, wrapper } = await mountView()

    await categoryButton(wrapper, 'India').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ category: 'india' })
    expect(toolNames(wrapper)).toEqual([
      'GST Calculator',
      'HSN & SAC Lookup',
      'India Business Lookup',
    ])
    expect(wrapper.get('button[aria-pressed="true"]').text()).toBe('India')
  })

  it('honours a valid category query and rejects an unknown category', async () => {
    const convert = await mountView('/all-tools?category=convert')
    expect(toolNames(convert.wrapper)).toEqual(['Unit Converter', 'Currency Converter'])

    convert.wrapper.unmount()
    const unknown = await mountView('/all-tools?category=unknown')
    expect(toolNames(unknown.wrapper)).toHaveLength(13)
    expect(unknown.wrapper.get('button[aria-pressed="true"]').text()).toBe('All')
  })

  it('shows a clear empty state when filters have no matches', async () => {
    const { wrapper } = await mountView('/all-tools?category=time')

    await wrapper.get('input[placeholder="Search all tools"]').setValue('calculator')

    expect(wrapper.findAll('[data-tool-row]')).toHaveLength(0)
    expect(wrapper.text()).toContain('No matching tools')
  })
})

async function mountView(location = '/all-tools') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/all-tools', component: AllToolsView }],
  })
  await router.push(location)
  await router.isReady()
  const wrapper = mount(AllToolsView, {
    global: {
      plugins: [router],
      stubs: { ToolRow: ToolRowStub },
    },
  })
  return { router, wrapper }
}

function toolNames(wrapper) {
  return wrapper.findAll('[data-tool-row]').map((row) => row.text())
}

function categoryButton(wrapper, label) {
  return wrapper.findAll('button').find((button) => button.text() === label)
}
