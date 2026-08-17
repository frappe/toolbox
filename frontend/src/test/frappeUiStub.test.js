import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { Alert, Button, Dropdown, Icon, Slider, TabButtons } from 'frappe-ui'
import { describe, expect, it, vi } from 'vitest'

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

describe('Dropdown stub opens and runs its options', () => {
  const mountDropdown = (options) =>
    mount(Dropdown, { props: { options }, slots: { default: '<button>Export</button>' } })

  it('keeps the menu closed until the trigger is clicked', async () => {
    const wrapper = mountDropdown([{ label: 'Markdown', onClick: vi.fn() }])
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    await wrapper.find('[data-component="Dropdown"] > div').trigger('click')

    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
    expect(wrapper.findAll('[role="menuitem"]').map((i) => i.text())).toEqual(['Markdown'])
  })

  it('runs the option handler and closes', async () => {
    const onClick = vi.fn()
    const wrapper = mountDropdown([{ label: 'Markdown', onClick }])

    await wrapper.find('[data-component="Dropdown"] > div').trigger('click')
    await wrapper.find('[role="menuitem"]').trigger('click')

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  // Three option shapes the real Menu understands. A stub that silently ignored any of them
  // would let a caller ship an option that renders nothing, and the suite would stay green.
  it('pushes a route option through the router', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/settings', component: { template: '<div />' } },
      ],
    })
    const wrapper = mount(Dropdown, {
      props: { options: [{ label: 'Settings', route: '/settings' }] },
      slots: { default: '<button>Menu</button>' },
      global: { plugins: [router] },
    })

    await wrapper.find('[data-component="Dropdown"] > div').trigger('click')
    await wrapper.find('[role="menuitem"]').trigger('click')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/settings')
  })

  it('renders a component option, and a disabled one is inert', async () => {
    const onClick = vi.fn()
    const Summary = { template: '<p>Free tools, no account</p>' }
    const wrapper = mountDropdown([{ component: Summary, disabled: true, onClick }])

    await wrapper.find('[data-component="Dropdown"] > div').trigger('click')
    const row = wrapper.find('[role="menuitem"]')

    expect(row.text()).toContain('Free tools, no account')
    expect(row.attributes('disabled')).toBeDefined()
    await row.trigger('click')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('hands the trigger slot its open state', async () => {
    const wrapper = mount(Dropdown, {
      props: { options: [{ label: 'Markdown', onClick: vi.fn() }] },
      slots: { trigger: '<button :aria-expanded="String(params.open)">Menu</button>' },
    })

    expect(wrapper.find('button').attributes('aria-expanded')).toBe('false')
    await wrapper.find('[data-component="Dropdown"] > div').trigger('click')
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('true')
  })

  it('drops options whose condition is false', async () => {
    const wrapper = mountDropdown([
      { label: 'Markdown', onClick: vi.fn() },
      { label: 'HTML', onClick: vi.fn(), condition: () => false },
    ])
    await wrapper.find('[data-component="Dropdown"] > div').trigger('click')

    expect(wrapper.findAll('[role="menuitem"]').map((i) => i.text())).toEqual(['Markdown'])
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

  it('consumes variant rather than drawing it as an attribute', () => {
    // The real component reads `variant` to choose a fill or a border and renders no such
    // attribute. A stub that let it fall through to `attrs` would draw one.
    const wrapper = mount(Alert, { props: { title: 'Heads up', variant: 'outline' } })

    expect(wrapper.attributes('variant')).toBeUndefined()
  })
})

describe('TabButtons stub renders a routed option as a link', () => {
  it('draws an anchor when an option carries a route, and a button when it does not', () => {
    const wrapper = mount(TabButtons, {
      props: {
        modelValue: 'timer',
        options: [
          { label: 'Timer', value: 'timer', route: '/timer' },
          { label: 'Duration', value: 'duration' },
        ],
      },
    })
    const [routed, plain] = wrapper.findAll('[data-slot="tab-button"]')

    // The real component renders a routed option through RouterLink. A stub that drew a
    // button either way would hide a strip whose links go nowhere, which is the whole
    // reason these options carry a route.
    expect(routed.element.tagName).toBe('A')
    expect(routed.attributes('href')).toBe('/timer')
    expect(routed.attributes('aria-checked')).toBe('true')
    expect(plain.element.tagName).toBe('BUTTON')
    expect(plain.attributes('href')).toBeUndefined()
  })
})

describe('Icon stub renders the name the way the real component does', () => {
  it('puts a lucide name on the class, and invents no attribute for it', () => {
    // The real component is `:class="[name]"`. The stub drew a `data-icon` attribute instead, so
    // a test could assert on something no visitor ever receives, and could not assert on the
    // class that ships.
    const wrapper = mount(Icon, { props: { name: 'lucide-panel-right-open' } })

    expect(wrapper.classes()).toContain('lucide-panel-right-open')
    expect(wrapper.attributes('data-icon')).toBeUndefined()
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })

  it('keeps a class the caller passed alongside the icon name', () => {
    const wrapper = mount(Icon, {
      props: { name: 'lucide-panel-right-open' },
      attrs: { class: 'rotate-180' },
    })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['lucide-panel-right-open', 'rotate-180']))
  })
})
