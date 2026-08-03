import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PinMap from '@/tools/india-business-lookup/PinMap.vue'

const RESULTS = [
  { pin_code: '560001', office_name: 'Bengaluru G.P.O.', latitude: '12.97', longitude: '77.59' },
  { pin_code: '110001', office_name: 'New Delhi G.P.O.', latitude: '28.61', longitude: '77.20' },
  { pin_code: '999999', office_name: 'No Coords B.O', latitude: '', longitude: '' },
]

describe('PinMap', () => {
  it('plots only located offices and reports the rest honestly', () => {
    const wrapper = mount(PinMap, { props: { results: RESULTS } })

    expect(wrapper.findAll('circle.pin-map__marker')).toHaveLength(2)
    expect(wrapper.text()).toContain('2 offices on the map')
    expect(wrapper.text()).toContain('1 without coordinates')
    // The India outline is bundled and drawn.
    expect(wrapper.findAll('path.pin-map__state').length).toBeGreaterThan(20)
  })

  it('zooms with the controls and resets to the full view', async () => {
    const wrapper = mount(PinMap, { props: { results: RESULTS } })
    const transform = () => wrapper.find('g').attributes('transform')

    const initial = transform()
    await wrapper.get('button[aria-label="Zoom in"]').trigger('click')
    expect(transform()).not.toBe(initial)
    await wrapper.get('button[aria-label="Reset view"]').trigger('click')
    expect(transform()).toBe('translate(0 0) scale(1)')
  })
})
