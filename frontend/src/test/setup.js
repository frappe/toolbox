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

// Both, because Toolbox keeps almost everything for the browser session and the theme alone in
// localStorage. A suite that only defined one silently tested the other against jsdom's own copy,
// which nothing cleared between tests.
for (const kind of ['localStorage', 'sessionStorage']) {
  Object.defineProperty(globalThis, kind, {
    configurable: true,
    value: new TestStorage(),
  })
}

enableAutoUnmount(afterEach)

afterEach(() => {
  globalThis.localStorage.clear()
  globalThis.sessionStorage.clear()
  vi.clearAllMocks()
})

vi.mock('frappe-ui', async () => {
  const { computed, defineComponent, getCurrentInstance, h, inject, provide, ref, resolveComponent } =
    await import('vue')

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
    // The real component renders a lucide name as a class (`:class="[name]"`). The stub drew a
    // `data-icon` attribute instead, which the real component never emits, so a test could assert
    // on something no visitor ever gets and could not assert on the class that ships.
    setup(props, { attrs }) {
      return () =>
        h('span', { ...attrs, class: [attrs.class, props.name], 'aria-hidden': 'true' })
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

  // Mirrors the observable surface of frappe-ui Dropdown: a trigger (the `#trigger`
  // slot, else the default slot), and — once opened — a `role="menu"` of
  // `role="menuitem"` rows. The menu really is absent until the trigger is clicked,
  // so keep it behind `open` rather than rendering it always: the real component does
  // not show it either.
  //
  // Three things the real component does that this has to do as well, or a caller can
  // pass an option shape the stub silently drops:
  //
  //   * `route` is pushed through the router by `Menu.handleItemSelect`. It is NOT an
  //     anchor there, so this is a button that pushes — rendering an `<a href>` would
  //     be an output the real component omits.
  //   * `component` replaces the row. reka still wraps it in its Item primitive, so a
  //     `disabled` one carries the attribute and is skipped by the roving focus.
  //   * `#trigger` receives `{ open }`, which is what a caller binds `aria-expanded` to.
  const Dropdown = defineComponent({
    name: 'Dropdown',
    inheritAttrs: false,
    props: {
      options: { type: Array, default: () => [] },
    },
    emits: ['update:open'],
    setup(props, { attrs, slots, emit }) {
      const open = ref(false)
      // Resolved from the app rather than imported, for the same reason `SidebarItem` does it:
      // a spec is free to mock `vue-router`, and an import here would pick up that mock.
      const globals = getCurrentInstance()?.appContext.config.globalProperties

      // `condition` decides whether an option exists at all, as in Menu/utils.ts.
      const visible = () => props.options.filter((option) => !option.condition || option.condition())

      const setOpen = (next) => {
        open.value = next
        emit('update:open', next)
      }

      const renderOption = (option) =>
        h(
          'button',
          {
            key: String(option.label ?? 'component'),
            type: 'button',
            role: 'menuitem',
            disabled: option.disabled || undefined,
            'data-disabled': option.disabled ? '' : undefined,
            onClick: () => {
              if (option.disabled) return
              if (option.route) globals?.$router?.push(option.route)
              option.onClick?.()
              setOpen(false)
            },
          },
          option.component ? [h(option.component)] : option.label,
        )

      return () =>
        h('div', { ...attrs, 'data-component': 'Dropdown' }, [
          h('div', { onClick: () => setOpen(!open.value) }, slots.trigger?.({ open: open.value }) ?? slots.default?.({ open: open.value })),
          open.value ? h('div', { role: 'menu' }, visible().map(renderOption)) : null,
        ])
    },
  })

  // Mirrors the observable surface of frappe-ui KeyboardShortcut: a `role="note"` with an
  // aria-label naming the keys, and one `<kbd>` per part under `bg`. The real component resolves
  // `Mod` per platform and draws glyphs for the modifiers; the shape is what a caller can assert.
  const KeyboardShortcut = defineComponent({
    name: 'KeyboardShortcut',
    inheritAttrs: false,
    props: {
      combo: { type: String, default: '' },
      shortcut: { type: String, default: '' },
      bg: { type: Boolean, default: false },
    },
    setup(props, { attrs }) {
      const parts = () => (props.combo || props.shortcut).split('+').filter(Boolean)
      return () =>
        h(
          'span',
          { ...attrs, role: 'note', 'aria-label': parts().join(' ') },
          parts().map((part) => h('kbd', { key: part }, part)),
        )
    },
  })

  const Alert = defineComponent({
    name: 'Alert',
    inheritAttrs: false,
    props: {
      title: { type: String, default: '' },
      theme: { type: String, default: '' },
      // Declared so it is consumed rather than falling through to `attrs`. The real component
      // reads `variant` to choose a fill or a border and renders no such DOM attribute, and a
      // stub must never render an output the real component omits.
      variant: { type: String, default: 'subtle' },
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
            // The real component renders an option carrying a `route` as a RouterLink, so it
            // is an anchor rather than a button. A stub that draws a button either way would
            // hide a strip that navigates nowhere.
            const link = Boolean(option.route)
            return h(
              link ? 'a' : 'button',
              {
                key: String(option.value),
                ...(link ? { href: option.route } : { type: 'button' }),
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

  // The settings dialog is a reka-ui Tabs set inside a Dialog. These mirror what the real
  // components put in the document: the tablist/tab/tabpanel roles, the selected state reka
  // writes as `data-state`, and the `hidden` attribute it puts on an inactive panel. The tab
  // value travels by provide/inject here, the way reka's own context does.
  const TAB_CONTEXT = Symbol('settings-tab')

  const SettingsDialog = defineComponent({
    name: 'SettingsDialog',
    inheritAttrs: false,
    props: {
      modelValue: { type: Boolean, default: false },
      tab: { type: [String, Number], default: '' },
      size: { type: String, default: '4xl' },
      shortcut: { type: Boolean, default: true },
      unmountOnHide: { type: Boolean, default: true },
    },
    emits: ['update:modelValue', 'update:tab'],
    setup(props, { attrs, slots, emit }) {
      provide(TAB_CONTEXT, {
        active: computed(() => props.tab),
        select: (value) => emit('update:tab', value),
      })
      return () =>
        props.modelValue
          ? h(
              'div',
              { ...attrs, role: 'dialog', 'aria-modal': 'true', 'data-component': 'SettingsDialog' },
              [slots.title?.(), slots.description?.(), slots.default?.()],
            )
          : null
    },
  })

  const SettingsSidebar = defineComponent({
    name: 'SettingsSidebar',
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', { ...attrs, role: 'tablist', 'aria-orientation': 'vertical' }, slots.default?.())
    },
  })

  const SettingsNavGroup = defineComponent({
    name: 'SettingsNavGroup',
    inheritAttrs: false,
    props: { label: { type: String, default: '' } },
    setup(props, { attrs, slots }) {
      return () =>
        h('div', attrs, [
          props.label || slots.label ? h('div', {}, slots.label?.() ?? props.label) : null,
          h('div', {}, slots.default?.()),
        ])
    },
  })

  const SettingsNavItem = defineComponent({
    name: 'SettingsNavItem',
    inheritAttrs: false,
    props: { value: { type: [String, Number], required: true } },
    setup(props, { attrs, slots }) {
      const tabs = inject(TAB_CONTEXT, null)
      return () => {
        const active = tabs?.active.value === props.value
        return h(
          'button',
          {
            ...attrs,
            type: 'button',
            role: 'tab',
            'aria-selected': active ? 'true' : 'false',
            'data-state': active ? 'active' : 'inactive',
            onClick: () => tabs?.select(props.value),
          },
          [slots.prefix?.(), h('span', {}, slots.default?.()), slots.suffix?.()],
        )
      }
    },
  })

  const SettingsContent = defineComponent({
    name: 'SettingsContent',
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, slots.default?.())
    },
  })

  const SettingsPanel = defineComponent({
    name: 'SettingsPanel',
    inheritAttrs: false,
    props: { value: { type: [String, Number], required: true } },
    setup(props, { attrs, slots }) {
      const tabs = inject(TAB_CONTEXT, null)
      return () => {
        const active = tabs?.active.value === props.value
        // reka hides an inactive panel with the `hidden` attribute, and unmounts its content
        // unless the dialog is told not to. The default is to unmount, so the stub does.
        if (!active) return h('div', { ...attrs, role: 'tabpanel', hidden: true, 'data-state': 'inactive' })
        return h('div', { ...attrs, role: 'tabpanel', 'data-state': 'active' }, slots.default?.())
      }
    },
  })

  const SettingsHeader = defineComponent({
    name: 'SettingsHeader',
    inheritAttrs: false,
    props: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
    },
    setup(props, { attrs, slots }) {
      return () =>
        h(
          'div',
          attrs,
          slots.default?.() ?? [
            props.title ? h('h2', {}, props.title) : null,
            props.description ? h('p', {}, props.description) : null,
            slots.actions ? h('div', {}, slots.actions()) : null,
          ],
        )
    },
  })

  const SettingsBody = defineComponent({
    name: 'SettingsBody',
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, slots.default?.())
    },
  })

  const SettingsRow = defineComponent({
    name: 'SettingsRow',
    inheritAttrs: false,
    props: {
      title: { type: String, required: true },
      description: { type: String, default: '' },
      labelFor: { type: String, default: '' },
    },
    // The real component renders a `<label>` only when it can resolve a control to point at,
    // and a `<div>` otherwise. It never renders a label with no `for`.
    setup(props, { attrs, slots }) {
      return () =>
        h('div', attrs, [
          h('div', {}, [
            h(props.labelFor ? 'label' : 'div', props.labelFor ? { for: props.labelFor } : {}, props.title),
            props.description ? h('div', {}, props.description) : null,
          ]),
          h('div', {}, slots.default?.()),
        ])
    },
  })

  // The sidebar family. `Sidebar` provides the collapsed state and the toggle, and every other
  // part reads them through inject — which is the reason none of them takes `collapsed` as a prop.
  const sidebarCollapsedKey = Symbol('sidebarCollapsed')
  const sidebarToggleKey = Symbol('sidebarToggle')

  const Sidebar = defineComponent({
    name: 'Sidebar',
    inheritAttrs: false,
    props: {
      // Untyped, because `null` and `false` mean different things: unset falls back to the
      // breakpoint, and a Boolean prop would collapse that distinction before it is read.
      collapsed: { type: null, default: null },
      disableCollapse: { type: Boolean, default: false },
      width: { type: String, default: '15rem' },
      collapsedWidth: { type: String, default: '3rem' },
    },
    emits: ['update:collapsed'],
    setup(props, { attrs, emit, slots }) {
      // The real component resolves `(model ?? isMobile) && !disableCollapse`, reading the sm
      // breakpoint. A test that wants the mobile path sets `innerWidth` before it mounts: this is
      // read once, because nothing here makes the width reactive.
      const shouldCollapse = computed(
        () => (props.collapsed ?? globalThis.innerWidth < 640) && !props.disableCollapse,
      )

      provide(sidebarCollapsedKey, shouldCollapse)
      provide(sidebarToggleKey, () => emit('update:collapsed', !shouldCollapse.value))

      return () =>
        h(
          'div',
          {
            ...attrs,
            'data-slot': 'sidebar',
            'data-state': shouldCollapse.value ? 'collapsed' : 'expanded',
            style: { width: shouldCollapse.value ? props.collapsedWidth : props.width },
          },
          slots.default?.(),
        )
    },
  })

  // Mirrors the four things a call site gets wrong about SidebarItem:
  //  - `to` is what makes it a link. Without it the row is a button, and there is no href.
  //  - `aria-label` is the label always, not only while collapsed.
  //  - `suffix` is a string. The real prop rejects a number, so `:suffix="list.length"` is a bug.
  //  - collapsing hides the label and the suffix but keeps both in the DOM.
  const SidebarItem = defineComponent({
    name: 'SidebarItem',
    inheritAttrs: false,
    props: {
      label: { type: String, default: '' },
      icon: { type: [String, Object, Function], default: undefined },
      suffix: { type: String, default: '' },
      to: { type: [String, Object], default: undefined },
      active: { type: Boolean, default: undefined },
      accessKey: { type: String, default: undefined },
      onClick: { type: Function, default: undefined },
    },
    setup(props, { attrs, slots }) {
      const globals = getCurrentInstance()?.appContext.config.globalProperties
      const isCollapsed = inject(
        sidebarCollapsedKey,
        computed(() => false),
      )
      const isActive = computed(() => {
        if (props.active !== undefined) return props.active
        const current = globals?.$route
        return Boolean(current && typeof props.to === 'string' && current.path === props.to)
      })

      const hiddenWhenCollapsed = () =>
        isCollapsed.value ? 'w-0 overflow-hidden opacity-0' : 'opacity-100'

      const contents = () => [
        h(
          'span',
          {},
          slots.prefix?.() ??
            (typeof props.icon === 'string' ? [h('span', { class: props.icon })] : []),
        ),
        h('span', { class: hiddenWhenCollapsed() }, slots.default?.() ?? props.label),
      ]

      // The real component renders a RouterLink when a router is installed and a plain <a>
      // otherwise. RouterLink is resolved here rather than imported, because a spec is free to
      // mock `vue-router` and an import in this factory would pick up that mock instead.
      const renderLink = () => {
        const shared = {
          accesskey: props.accessKey,
          'aria-label': props.label || undefined,
          'aria-current': isActive.value ? 'page' : undefined,
          onClick: (event) => props.onClick?.(event),
        }

        if (!globals?.$router) {
          const href = typeof props.to === 'string' ? props.to : undefined
          return h('a', { ...shared, href }, contents())
        }

        return h(resolveComponent('RouterLink'), { ...shared, to: props.to }, { default: contents })
      }

      return () =>
        h(
          'div',
          {
            ...attrs,
            'data-slot': 'sidebar-item',
            'data-state': isActive.value ? 'active' : 'inactive',
          },
          [
            props.to
              ? renderLink()
              : h(
                  'button',
                  {
                    type: 'button',
                    accesskey: props.accessKey,
                    'aria-label': props.label || undefined,
                    onClick: (event) => props.onClick?.(event),
                  },
                  contents(),
                ),
            h(
              'div',
              { 'data-slot': 'sidebar-item-suffix', class: hiddenWhenCollapsed() },
              slots.suffix?.() ?? (props.suffix ? [h('span', {}, props.suffix)] : []),
            ),
          ],
        )
    },
  })

  // A SidebarItem whose label says what the click will do, so it reads "Expand" once collapsed.
  const SidebarCollapseToggle = defineComponent({
    name: 'SidebarCollapseToggle',
    inheritAttrs: false,
    setup(_, { attrs }) {
      const isCollapsed = inject(
        sidebarCollapsedKey,
        computed(() => false),
      )
      // No-op fallback, so a toggle outside a Sidebar renders and does nothing rather than throws.
      const toggle = inject(sidebarToggleKey, () => {})

      return () =>
        h(SidebarItem, { ...attrs, label: isCollapsed.value ? 'Expand' : 'Collapse', onClick: toggle }, {
          prefix: () =>
            h('span', {
              class: [
                'lucide-panel-right-open size-4 text-ink-gray-6',
                isCollapsed.value ? 'rotate-180' : '',
              ],
            }),
        })
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
    KeyboardShortcut,
    LoadingIndicator,
    LoadingText,
    SettingsBody,
    SettingsContent,
    SettingsDialog,
    SettingsHeader,
    SettingsNavGroup,
    SettingsNavItem,
    SettingsPanel,
    SettingsRow,
    SettingsSidebar,
    Sidebar,
    SidebarCollapseToggle,
    SidebarItem,
    Slider,
    TabButtons,
    TextInput,
    Tooltip,
    frappeRequest: vi.fn(),
    sidebarCollapsedKey,
    sidebarToggleKey,
  }
})
