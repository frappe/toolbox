import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useRoute } from 'vue-router'

import { tools } from '@/data/toolRegistry'
import UnitConverterView from './UnitConverterView.vue'

// Each measurement is its own tool at its own URL, so which one is showing comes from the route.
// The route object is reactive, so assigning `meta` moves the view the way a navigation does.
vi.mock('vue-router', async (importOriginal) => {
  const { reactive } = await import('vue')
  const route = reactive({ meta: {}, path: '/length-converter' })
  return { ...(await importOriginal()), useRoute: () => route }
})

const route = useRoute()

// The real RouterLink needs an injected router. This renders what it renders: an anchor whose
// href is `to`, with every other attribute passed through.
const RouterLink = {
  props: { to: { type: String, required: true } },
  setup(props, { attrs, slots }) {
    return () => h('a', { ...attrs, href: props.to }, slots.default?.())
  },
}

function toolFor(variant) {
  return tools.find((tool) => tool.family === 'unit-converter' && tool.variant === variant)
}

function mountView(variant = 'length') {
  const tool = toolFor(variant)
  route.meta = { toolId: tool.id }
  route.path = tool.route
  return mount(UnitConverterView, { attachTo: document.body, global: { stubs: { RouterLink } } })
}

async function goToCategory(variant) {
  const tool = toolFor(variant)
  route.meta = { toolId: tool.id }
  route.path = tool.route
  await nextTick()
  await flushPromises()
}

function valueInputs(wrapper) {
  return wrapper.findAll('input[inputmode="decimal"]')
}

describe('UnitConverterView', () => {
  it('converts edits in both fields immediately', async () => {
    const wrapper = mountView()
    const [fromInput, toInput] = valueInputs(wrapper)

    await fromInput.setValue('1000')
    expect(toInput.element.value).toBe('1')

    await toInput.setValue('2.5')
    expect(fromInput.element.value).toBe('2500')
  })

  it('changes category defaults and applies temperature formulas', async () => {
    const wrapper = mountView()
    await goToCategory('temperature')
    const [fromInput, toInput] = valueInputs(wrapper)
    await fromInput.setValue('0')

    expect(wrapper.text()).toContain('Celsius')
    expect(wrapper.text()).toContain('Fahrenheit')
    expect(toInput.element.value).toBe('32')
  })

  it('searches for and selects a source unit', async () => {
    const wrapper = mountView()
    const pickerTriggers = wrapper.findAll('button[aria-haspopup="listbox"]')
    await pickerTriggers[0].trigger('click')
    await wrapper.get('[role="combobox"]').setValue('feet')
    await wrapper.get('[role="option"]').trigger('click')

    expect(wrapper.findAll('button[aria-haspopup="listbox"]')[0].text()).toContain('Foot')
  })

  it('swaps displayed units and values', async () => {
    const wrapper = mountView()
    const [fromInput, toInput] = valueInputs(wrapper)
    await fromInput.setValue('1000')
    await wrapper.get('[data-testid="swap-units"]').trigger('click')

    expect(fromInput.element.value).toBe('1')
    expect(toInput.element.value).toBe('1000')
    const pickerTriggers = wrapper.findAll('button[aria-haspopup="listbox"]')
    expect(pickerTriggers[0].text()).toContain('Kilometer')
    expect(pickerTriggers[1].text()).toContain('Meter')
  })

  it('keeps the previous result through partial and invalid edits', async () => {
    const wrapper = mountView()
    const [fromInput, toInput] = valueInputs(wrapper)
    await fromInput.setValue('1000')

    await fromInput.setValue('-')
    expect(toInput.element.value).toBe('1')
    expect(wrapper.text()).toContain('Finish entering')

    await fromInput.setValue('invalid')
    expect(toInput.element.value).toBe('1')
    expect(wrapper.get('[role="alert"]').text()).toContain('valid, finite')
  })

  it('politely announces only valid programmatic result updates', async () => {
    const wrapper = mountView()
    const [fromInput] = valueInputs(wrapper)
    const announcement = wrapper.get('[data-testid="conversion-announcement"]')

    expect(announcement.attributes('role')).toBe('status')
    expect(announcement.attributes('aria-live')).toBe('polite')
    expect(announcement.attributes('aria-atomic')).toBe('true')
    expect(announcement.text()).toBe('')

    await fromInput.setValue('1000')
    expect(announcement.text()).toBe('Converted value: 1. Unit: kilometer.')

    await fromInput.setValue('-')
    expect(announcement.text()).toBe('')

    await fromInput.setValue('invalid')
    expect(announcement.text()).toBe('')

    await fromInput.setValue('')
    expect(announcement.text()).toBe('')
  })


  it('converts as the value is typed, without waiting for a commit', async () => {
    const wrapper = mountView()
    await valueInputs(wrapper)[0].setValue('1000')
    await flushPromises()

    // 1000 m is 1 km. The opposite field used to be filled on `change` as well, because that is
    // what recorded a history row; conversion itself never needed the commit.
    expect(valueInputs(wrapper)[1].element.value).toBe('1')
  })

  it('clears the values while keeping the chosen category', async () => {
    const wrapper = mountView()
    await goToCategory('temperature')
    await valueInputs(wrapper)[0].setValue('10')
    const clearButton = wrapper.findAll('button').find((button) => button.text() === 'Clear')
    await clearButton.trigger('click')
    expect(valueInputs(wrapper).map((input) => input.element.value)).toEqual(['', ''])
    // A single Clear empties the values but keeps the user's category.
    expect(wrapper.find('h1').text()).toBe('Temperature Converter')
  })
})
