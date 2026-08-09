import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import MetronomeView from './MetronomeView.vue'

// Regression cover for #143. frappe-ui Slider models its value as an array and falls
// back to `[min]` for anything without `.length`, so a scalar binding silently pins
// every thumb to the minimum and any interaction snaps the real value down with it.

// The controls sit behind `v-else` on Web Audio support, so jsdom needs a context.
// The metronome only constructs one on start(), so an empty class is enough.
beforeEach(() => {
  window.AudioContext = class {}
})

afterEach(() => {
  delete window.AudioContext
})

function mountView() {
  return mount(MetronomeView, { attachTo: document.body })
}

function sliders(wrapper) {
  return wrapper.findAll('input[type="range"]')
}

describe('MetronomeView sliders', () => {
  it('shows the real tempo and volume, not the minimum', () => {
    const wrapper = mountView()
    const [tempo, volume] = sliders(wrapper)

    expect(wrapper.text()).toContain('120')
    expect(tempo.element.value).toBe('120')
    expect(tempo.element.value).not.toBe(tempo.element.min)
    expect(volume.element.value).toBe('0.5')
  })

  it('moves the tempo from its current value, not from the minimum', async () => {
    const wrapper = mountView()
    const [tempo] = sliders(wrapper)

    await tempo.setValue('121')

    expect(wrapper.text()).toContain('121')
    expect(sliders(wrapper)[0].element.value).toBe('121')
  })
})
