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
  const { defineComponent, h, ref } = await import('vue')

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

  // Mirrors the three Button behaviours that call sites keep getting wrong:
  //  - `icon` makes it icon-only. The label leaves the DOM and survives only as the
  //    accessible name (#134). A stub that draws the label hides that.
  //  - `aria-label` is `props.label ?? attrs['aria-label']`, applied last, so `label`
  //    wins and a caller's `aria-label` is dead (#144).
  //  - `loading` sets the native `disabled`, so a loading button cannot be clicked
  //    and a `type="submit"` cannot submit.
  const Button = defineComponent({
    name: 'Button',
    inheritAttrs: false,
    props: {
      icon: { type: String, default: '' },
      label: { type: String, default: undefined },
      variant: { type: String, default: '' },
      type: { type: String, default: 'button' },
      loading: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
    },
    emits: ['click'],
    setup(props, { attrs, emit, slots }) {
      const isIconButton = () => Boolean(props.icon)
      const isDisabled = () => props.disabled || props.loading

      return () =>
        h(
          'button',
          {
            ...attrs,
            type: props.type,
            disabled: isDisabled() || undefined,
            'data-icon': props.icon,
            'data-variant': props.variant,
            'aria-label': props.label ?? attrs['aria-label'],
            'aria-busy': props.loading || undefined,
            onClick: (event) => emit('click', event),
          },
          isIconButton() ? null : (slots.default?.() ?? props.label),
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

  const LoadingText = defineComponent({
    name: 'LoadingText',
    inheritAttrs: false,
    props: {
      text: { type: String, default: 'Loading...' },
    },
    setup(props, { attrs }) {
      return () => h('div', { ...attrs, 'data-loading-indicator': '' }, props.text)
    },
  })

  // Mirrors the observable surface of frappe-ui Combobox in button mode: a
  // trigger (the `#trigger` slot, else a plain button), and — once open — a
  // `role="combobox"` search field over a `role="listbox"` of `role="option"`
  // rows. The real component portals the popover to `body`; the stub renders
  // it inline so mounted wrappers can still query it.
  const Combobox = defineComponent({
    name: 'Combobox',
    inheritAttrs: false,
    props: {
      modelValue: { type: [String, Number], default: null },
      options: { type: Array, default: () => [] },
      label: { type: String, default: '' },
      placeholder: { type: String, default: '' },
      emptyText: { type: String, default: 'No results' },
      query: { type: String, default: '' },
      size: { type: String, default: 'sm' },
      variant: { type: String, default: 'subtle' },
      trigger: { type: String, default: 'input' },
      filterable: { type: Boolean, default: true },
      disabled: { type: Boolean, default: false },
    },
    emits: ['update:modelValue', 'update:query', 'update:open'],
    setup(props, { attrs, emit, slots }) {
      const open = ref(false)

      function setOpen(value) {
        open.value = value
        emit('update:open', value)
      }

      function selectedOption() {
        return props.options.find((option) => option.value === props.modelValue) ?? null
      }

      function renderTrigger() {
        const slotProps = { open: open.value, disabled: false, query: props.query, selectedOption: selectedOption(), setOpen }
        if (slots.trigger) {
          return h('div', { onClick: () => setOpen(!open.value) }, slots.trigger(slotProps))
        }

        return h(
          'button',
          {
            type: 'button',
            'aria-haspopup': 'listbox',
            'aria-expanded': String(open.value),
            onClick: () => setOpen(!open.value),
          },
          selectedOption()?.label ?? props.placeholder,
        )
      }

      function renderOption(option) {
        return h(
          'button',
          {
            key: String(option.value),
            type: 'button',
            role: 'option',
            'aria-selected': option.value === props.modelValue,
            onClick: () => {
              emit('update:modelValue', option.value)
              setOpen(false)
            },
          },
          [
            slots['item-prefix']?.({ item: option }),
            option.label,
            slots['item-suffix']?.({ item: option }),
          ],
        )
      }

      return () =>
        h('div', { 'data-component': 'Combobox' }, [
          renderTrigger(),
          open.value
            ? h('div', {}, [
                h('input', {
                  ...attrs,
                  role: 'combobox',
                  value: props.query,
                  placeholder: props.placeholder,
                  onInput: (event) => emit('update:query', event.target.value),
                }),
                h(
                  'div',
                  { role: 'listbox' },
                  props.options.length
                    ? props.options.map(renderOption)
                    : h('p', { role: 'status' }, props.emptyText),
                ),
              ])
            : null,
        ])
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

  // Mirrors the parts of frappe-ui TextInput that views depend on: the `el`
  // handle for caret work, the `label`/`for` association, and the `error`
  // region (a `role="alert"` sibling plus `aria-invalid` on the control).
  const TextInput = defineComponent({
    name: 'TextInput',
    inheritAttrs: false,
    props: {
      modelValue: { type: [String, Number], default: '' },
      placeholder: { type: String, default: '' },
      size: { type: String, default: '' },
      variant: { type: String, default: '' },
      label: { type: String, default: '' },
      error: { type: String, default: '' },
      id: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit, expose }) {
      const inputRef = ref(null)
      expose({ el: inputRef })

      return () => {
        const inputId = props.id || attrs.id || undefined
        const input = h('input', {
          ...attrs,
          ref: inputRef,
          id: inputId,
          value: props.modelValue,
          placeholder: props.placeholder,
          'aria-label': attrs['aria-label'] || props.label || undefined,
          'aria-invalid': props.error ? 'true' : attrs['aria-invalid'],
          onInput: (event) => emit('update:modelValue', event.target.value),
        })

        if (!props.label && !props.error) return input

        return [
          props.label ? h('label', { for: inputId }, props.label) : null,
          input,
          props.error ? h('div', { role: 'alert' }, props.error) : null,
        ]
      }
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
      const withLabel = (control) =>
        props.label ? [h('label', { for: attrs.id }, props.label), control] : control

      return () => {
        if (props.type === 'select') {
          const options = props.options.map((option) =>
            typeof option === 'object' ? option : { label: String(option), value: option },
          )

          return withLabel(
            h(
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
            ),
          )
        }

        if (props.type === 'textarea') {
          return withLabel(
            h('textarea', {
              ...attrs,
              'aria-label': ariaLabel(),
              value: props.modelValue,
              onInput: (event) => emit('update:modelValue', event.target.value),
            }),
          )
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
        return withLabel(
          h('input', {
            ...attrs,
            type: props.type,
            'aria-label': ariaLabel(),
            value: props.modelValue,
            onInput: (event) => emit('update:modelValue', event.target.value),
          }),
        )
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
      // The real Alert declares icon/description/footer and no default slot, so
      // default-slot content renders nowhere. Do not draw it here.
      return () =>
        h('div', { ...attrs, role: 'alert', 'data-theme': props.theme || undefined }, [
          props.title,
          slots.description?.() ?? props.description,
          slots.footer?.(),
        ])
    },
  })

  // Mirrors the model contract of frappe-ui Slider, which is the part call sites get
  // wrong: the value is an ARRAY (`SliderValue = number[]`), and a value without
  // `.length` falls back to `[min]` — so a scalar binding pins the thumb to the
  // minimum. Keep the array type and the fallback exactly as the real component has
  // them, or this stub hides the bug instead of catching it.
  const Slider = defineComponent({
    name: 'Slider',
    inheritAttrs: false,
    props: {
      modelValue: { type: Array, default: undefined },
      min: { type: Number, default: 0 },
      max: { type: Number, default: 100 },
      step: { type: Number, default: 1 },
      label: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      const resolved = () => (props.modelValue?.length ? props.modelValue : [props.min])

      // The real Slider never binds `$attrs` — its root is LabelingWrapper, which drops
      // them — so `class`, `aria-label` and root listeners reach nothing. Dropping them
      // here too stops a call site relying on a name the app does not render.
      //
      // Known divergence: naming through `label` is kinder than the real component, which
      // puts `aria-labelledby` on a roleless wrapper and leaves the `role="slider"`
      // element unnamed. That is an upstream defect (#147); modelling it would make every
      // slider unqueryable without testing anything the app controls.
      return () =>
        h('input', {
          type: 'range',
          min: props.min,
          max: props.max,
          step: props.step,
          value: resolved()[0],
          'aria-label': props.label || undefined,
          onInput: (event) => emit('update:modelValue', [Number(event.target.value)]),
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
    Combobox,
    Dialog,
    Dropdown,
    ErrorMessage,
    FormControl,
    Icon,
    LoadingIndicator,
    LoadingText,
    Slider,
    TabButtons,
    TextInput,
    Tooltip,
    frappeRequest: vi.fn(),
  }
})
