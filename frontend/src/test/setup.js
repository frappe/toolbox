import { afterEach, vi } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'

class TestStorage {
  constructor() {
    this.values = new Map()
  }

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key) {
    return this.values.get(String(key)) ?? null
  }

  key(index) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key) {
    this.values.delete(String(key))
  }

  setItem(key, value) {
    this.values.set(String(key), String(value))
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: new TestStorage(),
})

enableAutoUnmount(afterEach)

afterEach(() => {
  globalThis.localStorage.clear()
  vi.clearAllMocks()
})

vi.mock('frappe-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const Dialog = defineComponent({
    name: 'Dialog',
    inheritAttrs: false,
    props: {
      open: { type: Boolean, default: false },
    },
    emits: ['update:open'],
    setup(props, { attrs, slots }) {
      return () =>
        props.open
          ? h('div', { ...attrs, role: 'dialog', 'data-component': 'Dialog' }, slots.default?.())
          : null
    },
  })

  const BottomSheet = defineComponent({
    name: 'BottomSheet',
    inheritAttrs: false,
    props: {
      open: { type: Boolean, default: false },
      title: { type: String, default: '' },
    },
    emits: ['update:open'],
    setup(props, { attrs, slots }) {
      return () =>
        props.open
          ? h('div', { ...attrs, role: 'dialog', 'aria-label': props.title }, slots.default?.())
          : null
    },
  })

  const Button = defineComponent({
    name: 'Button',
    inheritAttrs: false,
    props: {
      icon: { type: String, default: '' },
      label: { type: String, default: '' },
      variant: { type: String, default: '' },
    },
    emits: ['click'],
    setup(props, { attrs, emit, slots }) {
      return () =>
        h(
          'button',
          {
            ...attrs,
            type: 'button',
            'data-icon': props.icon,
            'data-variant': props.variant,
            onClick: (event) => emit('click', event),
          },
          props.label || slots.default?.(),
        )
    },
  })

  const Icon = defineComponent({
    name: 'Icon',
    inheritAttrs: false,
    props: {
      name: { type: String, required: true },
    },
    setup(props, { attrs }) {
      return () => h('span', { ...attrs, 'aria-hidden': 'true', 'data-icon': props.name })
    },
  })

  const LoadingIndicator = defineComponent({
    name: 'LoadingIndicator',
    inheritAttrs: false,
    setup(_, { attrs }) {
      return () => h('span', { ...attrs, 'data-loading-indicator': '' })
    },
  })

  const Badge = defineComponent({
    name: 'Badge',
    inheritAttrs: false,
    props: {
      label: { type: String, default: '' },
    },
    setup(props, { attrs }) {
      return () => h('span', attrs, props.label)
    },
  })

  const Checkbox = defineComponent({
    name: 'Checkbox',
    inheritAttrs: false,
    props: {
      modelValue: { type: Boolean, default: false },
      label: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () =>
        h('label', {}, [
          h('input', {
            ...attrs,
            type: 'checkbox',
            checked: props.modelValue,
            'aria-label': attrs['aria-label'] || props.label,
            onChange: (event) => emit('update:modelValue', event.target.checked),
          }),
          props.label,
        ])
    },
  })

  const TextInput = defineComponent({
    name: 'TextInput',
    inheritAttrs: false,
    props: {
      modelValue: { type: [String, Number], default: '' },
      placeholder: { type: String, default: '' },
      size: { type: String, default: '' },
      variant: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () =>
        h('input', {
          ...attrs,
          value: props.modelValue,
          placeholder: props.placeholder,
          onInput: (event) => emit('update:modelValue', event.target.value),
        })
    },
  })

  // Mirrors frappe-ui FormControl: dispatches to the right control by `type`
  // (select / textarea / checkbox / date / text-like). The visible label is
  // exposed as `aria-label` so label-driven queries resolve without rendering
  // the full labeling chrome.
  const FormControl = defineComponent({
    name: 'FormControl',
    inheritAttrs: false,
    props: {
      modelValue: { type: [String, Number, Boolean], default: '' },
      options: { type: Array, default: () => [] },
      label: { type: String, default: '' },
      size: { type: String, default: '' },
      type: { type: String, default: 'text' },
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      const ariaLabel = () => attrs['aria-label'] || props.label || undefined

      return () => {
        if (props.type === 'select') {
          const options = props.options.map((option) =>
            typeof option === 'object' ? option : { label: String(option), value: option },
          )

          return h(
            'select',
            {
              ...attrs,
              'aria-label': ariaLabel(),
              value: props.modelValue,
              onChange: (event) => {
                const selected = options[event.target.selectedIndex]
                emit('update:modelValue', selected?.value)
              },
            },
            options.map((option) =>
              h('option', { key: String(option.value), value: option.value }, option.label),
            ),
          )
        }

        if (props.type === 'textarea') {
          return h('textarea', {
            ...attrs,
            'aria-label': ariaLabel(),
            value: props.modelValue,
            onInput: (event) => emit('update:modelValue', event.target.value),
          })
        }

        if (props.type === 'checkbox') {
          return h('input', {
            ...attrs,
            type: 'checkbox',
            'aria-label': ariaLabel(),
            checked: Boolean(props.modelValue),
            onChange: (event) => emit('update:modelValue', event.target.checked),
          })
        }

        // text, number, search, date, email, url — a plain input carrying `type`.
        return h('input', {
          ...attrs,
          type: props.type,
          'aria-label': ariaLabel(),
          value: props.modelValue,
          onInput: (event) => emit('update:modelValue', event.target.value),
        })
      }
    },
  })

  const ErrorMessage = defineComponent({
    name: 'ErrorMessage',
    inheritAttrs: false,
    props: {
      message: { type: [String, Object], default: '' },
    },
    setup(props, { attrs }) {
      return () => {
        if (!props.message) return null
        const text = typeof props.message === 'string' ? props.message : props.message?.message || ''
        return h('div', { ...attrs, role: 'alert' }, text)
      }
    },
  })

  // Renders its trigger (default/trigger slot) so a wrapping Button still shows.
  // The menu options open on demand in the real component; tests only need the trigger.
  const Dropdown = defineComponent({
    name: 'Dropdown',
    inheritAttrs: false,
    props: {
      options: { type: Array, default: () => [] },
    },
    setup(_, { attrs, slots }) {
      return () => h('div', { ...attrs, 'data-component': 'Dropdown' }, slots.default?.() || slots.trigger?.())
    },
  })

  const Alert = defineComponent({
    name: 'Alert',
    inheritAttrs: false,
    props: {
      title: { type: String, default: '' },
      theme: { type: String, default: '' },
      description: { type: String, default: '' },
      dismissible: { type: Boolean, default: true },
      modelValue: { type: Boolean, default: true },
    },
    setup(props, { attrs, slots }) {
      return () =>
        h('div', { ...attrs, role: 'alert', 'data-theme': props.theme || undefined }, [
          props.title,
          slots.description?.() ?? props.description,
          slots.footer?.(),
          slots.default?.(),
        ])
    },
  })

  // Stand-in for the TipTap-based rich editor: a contenteditable region that echoes the
  // content, so views that use TextEditor render a `[role="textbox"]` in tests.
  const TextEditor = defineComponent({
    name: 'TextEditor',
    inheritAttrs: false,
    props: {
      content: { type: String, default: '' },
      placeholder: { type: String, default: '' },
    },
    emits: ['change'],
    setup(props, { attrs }) {
      return () =>
        h('div', {
          ...attrs,
          role: 'textbox',
          'aria-multiline': 'true',
          contenteditable: 'true',
          innerHTML: props.content,
        })
    },
  })

  // Renders the wrapped trigger (default slot); the tooltip text is exposed as an attr.
  const Tooltip = defineComponent({
    name: 'Tooltip',
    inheritAttrs: false,
    props: {
      text: { type: String, default: '' },
    },
    setup(props, { attrs, slots }) {
      return () => h('div', { ...attrs, 'data-tooltip': props.text }, slots.default?.())
    },
  })

  // Mirrors the observable surface of frappe-ui TabButtons (a reka radiogroup):
  // each option is a `[data-slot="tab-button"]` radio carrying `data-state` /
  // `aria-checked`, and a click emits that option's value.
  const TabButtons = defineComponent({
    name: 'TabButtons',
    inheritAttrs: false,
    props: {
      options: { type: Array, default: () => [] },
      modelValue: { type: [String, Number, Boolean], default: undefined },
      size: { type: String, default: 'sm' },
      type: { type: String, default: 'subtle' },
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () =>
        h(
          'div',
          { ...attrs, role: 'radiogroup' },
          props.options.map((option) => {
            const checked = Object.is(option.value, props.modelValue)
            return h(
              'button',
              {
                key: String(option.value),
                type: 'button',
                role: 'radio',
                'data-slot': 'tab-button',
                'data-state': checked ? 'checked' : 'unchecked',
                'aria-checked': checked ? 'true' : 'false',
                onClick: () => emit('update:modelValue', option.value),
              },
              option.label,
            )
          }),
        )
    },
  })

  return {
    Alert,
    Badge,
    BottomSheet,
    Button,
    Checkbox,
    Dialog,
    Dropdown,
    ErrorMessage,
    FormControl,
    Icon,
    LoadingIndicator,
    TabButtons,
    TextEditor,
    TextInput,
    Tooltip,
    frappeRequest: vi.fn(),
  }
})
