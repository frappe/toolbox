import { mount } from '@vue/test-utils'
import { Alert, Button, Slider } from 'frappe-ui'
import { describe, expect, it } from 'vitest'

// Guards the stub contract itself (#145).
//
// The rule: a stub may render LESS than the real component, but it must never accept
// an input the real component rejects, and never render an output the real component
// omits. Every defect audit #2 found had already passed the whole suite, because the
// stub was kinder than the component. These tests fail if that kindness comes back.

describe('Button stub matches the real precedence rules', () => {
  it('renders icon-only and keeps the label as the accessible name', () => {
    const wrapper = mount(Button, { props: { icon: 'lucide-trash-2', label: 'Delete' } })

    expect(wrapper.text()).toBe('')
    expect(wrapper.attributes('aria-label')).toBe('Delete')
  })

  it('lets label win over a caller aria-label', () => {
    const wrapper = mount(Button, {
      props: { label: 'Clear all' },
      attrs: { 'aria-label': 'Clear calculator history' },
    })

    expect(wrapper.attributes('aria-label')).toBe('Clear all')
  })

  it('falls back to a caller aria-label when there is no label', () => {
    const wrapper = mount(Button, { attrs: { 'aria-label': 'Zoom in' } })

    expect(wrapper.attributes('aria-label')).toBe('Zoom in')
  })

  it('honours type instead of forcing button', () => {
    expect(mount(Button, { props: { type: 'submit' } }).attributes('type')).toBe('submit')
  })

  it('disables while loading, so a loading button cannot be clicked or submit', () => {
    const wrapper = mount(Button, { props: { label: 'Saving…', loading: true, type: 'submit' } })

    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
  })
})

describe('Slider stub matches the real model contract', () => {
  it('pins to the minimum when the model is not an array', () => {
    const wrapper = mount(Slider, { props: { modelValue: 120, min: 30, max: 300 } })

    expect(wrapper.element.value).toBe('30')
  })

  it('shows the value when the model is an array', () => {
    const wrapper = mount(Slider, { props: { modelValue: [120], min: 30, max: 300 } })

    expect(wrapper.element.value).toBe('120')
  })

  it('emits an array', async () => {
    const wrapper = mount(Slider, { props: { modelValue: [120], min: 30, max: 300 } })
    // Go through the DOM: VueWrapper.setValue emits the raw value itself and would
    // never reach the stub's own input handler.
    await wrapper.find('input').setValue('121')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[121]])
  })
})

describe('Alert stub declares no default slot', () => {
  it('drops default-slot content, as the real component does', () => {
    const wrapper = mount(Alert, {
      props: { title: 'Heads up' },
      slots: { default: 'this renders nowhere' },
    })

    expect(wrapper.text()).toContain('Heads up')
    expect(wrapper.text()).not.toContain('this renders nowhere')
  })
})
