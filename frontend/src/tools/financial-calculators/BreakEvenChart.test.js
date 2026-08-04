import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BreakEvenChart from './BreakEvenChart.vue'

function mountChart(props = {}) {
  return mount(BreakEvenChart, {
    props: {
      fixedCost: 500_000,
      sellingPrice: 1_500,
      variableCost: 900,
      exactQuantity: 833.33,
      breakEvenQuantity: 834,
      ...props,
    },
  })
}

describe('BreakEvenChart', () => {
  it('draws a cost line, a revenue line, and the break-even marker', () => {
    const wrapper = mountChart()

    expect(wrapper.findAll('polyline')).toHaveLength(2)
    expect(wrapper.findAll('circle')).toHaveLength(1)
    expect(wrapper.text()).toContain('Revenue')
    expect(wrapper.text()).toContain('Total cost')
    expect(wrapper.text()).toContain('Break-even 834 units')
  })

  it('places the crossover where revenue meets cost', () => {
    const wrapper = mountChart()
    const circle = wrapper.get('circle')
    const cx = Number(circle.attributes('cx'))
    // The crossover sits within the plotting area, left of the right edge.
    expect(cx).toBeGreaterThan(10)
    expect(cx).toBeLessThan(310)
  })
})
