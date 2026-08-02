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
            'aria-label': props.label,
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

  const FormControl = defineComponent({
    name: 'FormControl',
    inheritAttrs: false,
    props: {
      modelValue: { type: [String, Number, Boolean], default: '' },
      options: { type: Array, default: () => [] },
      size: { type: String, default: '' },
      type: { type: String, default: 'text' },
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () => {
        const options = props.options.map((option) =>
          typeof option === 'object' ? option : { label: String(option), value: option },
        )

        return h(
          'select',
          {
            ...attrs,
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
    },
  })

  return {
    Badge,
    BottomSheet,
    Button,
    Checkbox,
    Dialog,
    FormControl,
    Icon,
    LoadingIndicator,
    TextInput,
    frappeRequest: vi.fn(),
  }
})
