import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TagInput from './TagInput.vue'

function mountTagInput(props = {}) {
  return mount(TagInput, {
    props: { modelValue: [], ...props },
    attachTo: document.body,
  })
}

describe('TagInput', () => {
  it('renders each tag with a labelled remove button and associates the label', () => {
    const wrapper = mountTagInput({ modelValue: ['alpha', 'beta'], label: 'Tags' })

    expect(wrapper.text()).toContain('alpha')
    expect(wrapper.text()).toContain('beta')
    expect(wrapper.find('[aria-label="Remove tag alpha"]').exists()).toBe(true)

    const input = wrapper.get('input')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
  })

  it('commits a typed tag on Enter with a fresh array', async () => {
    const wrapper = mountTagInput()
    const input = wrapper.get('input')

    await input.setValue('vue')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')[0]).toEqual([['vue']])
    expect(input.element.value).toBe('')
  })

  it('commits on comma', async () => {
    const wrapper = mountTagInput()
    const input = wrapper.get('input')

    await input.setValue('notes')
    await input.trigger('keydown', { key: ',' })

    expect(wrapper.emitted('update:modelValue')[0][0]).toEqual(['notes'])
  })

  it('commits a non-empty value on blur', async () => {
    const wrapper = mountTagInput()
    const input = wrapper.get('input')

    await input.setValue('inbox')
    await input.trigger('blur')

    expect(wrapper.emitted('update:modelValue')[0][0]).toEqual(['inbox'])
  })

  it('trims whitespace and ignores empty input', async () => {
    const wrapper = mountTagInput()
    const input = wrapper.get('input')

    await input.setValue('   ')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await input.setValue('  spaced  ')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')[0][0]).toEqual(['spaced'])
  })

  it('ignores case-insensitive duplicates but still clears the field', async () => {
    const wrapper = mountTagInput({ modelValue: ['Vue'] })
    const input = wrapper.get('input')

    await input.setValue('vue')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(input.element.value).toBe('')
  })

  it('removes the last tag on Backspace only when the input is empty', async () => {
    const wrapper = mountTagInput({ modelValue: ['a', 'b'] })
    const input = wrapper.get('input')

    await input.setValue('typing')
    await input.trigger('keydown', { key: 'Backspace' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await input.setValue('')
    await input.trigger('keydown', { key: 'Backspace' })
    expect(wrapper.emitted('update:modelValue')[0][0]).toEqual(['a'])
  })

  it('removes a specific tag when its remove button is clicked', async () => {
    const wrapper = mountTagInput({ modelValue: ['a', 'b', 'c'] })

    await wrapper.get('[aria-label="Remove tag b"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')[0][0]).toEqual(['a', 'c'])
  })

  it('stops additions and disables the input once maxTags is reached', async () => {
    const wrapper = mountTagInput({ modelValue: ['a', 'b'], maxTags: 2 })
    const input = wrapper.get('input')

    expect(input.attributes('disabled')).toBeDefined()

    await input.setValue('c')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('never mutates the prop array', async () => {
    const model = ['a']
    const wrapper = mountTagInput({ modelValue: model })
    const input = wrapper.get('input')

    await input.setValue('b')
    await input.trigger('keydown', { key: 'Enter' })

    const emitted = wrapper.emitted('update:modelValue')[0][0]
    expect(emitted).toEqual(['a', 'b'])
    expect(emitted).not.toBe(model)
    expect(model).toEqual(['a'])
  })
})
