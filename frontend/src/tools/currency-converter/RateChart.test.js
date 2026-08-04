import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import RateChart from './RateChart.vue'
import { RATE_CHART_RANGES } from './rateHistory'

const series = {
  base: 'USD',
  quote: 'INR',
  range: '1Y',
  points: [
    { date: '2025-08-01', value: 88.2 },
    { date: '2026-02-01', value: 92.5 },
    { date: '2026-08-01', value: 95.4 },
  ],
  source: { name: 'European Central Bank', url: 'https://example.com' },
}

function mountChart(props = {}) {
  return mount(RateChart, {
    props: { ranges: RATE_CHART_RANGES, base: 'USD', quote: 'INR', ...props },
  })
}

describe('RateChart', () => {
  it('renders a polyline and range controls for a ready series', () => {
    const wrapper = mountChart({ series, range: '1Y', state: 'ready' })

    const polyline = wrapper.get('polyline')
    // One coordinate pair per point.
    expect(polyline.attributes('points').trim().split(' ')).toHaveLength(series.points.length)
    for (const option of RATE_CHART_RANGES) {
      expect(wrapper.findAll('button').some((button) => button.text() === option.label)).toBe(true)
    }
    // The latest rate and a download action are offered.
    expect(wrapper.text()).toContain('95.4')
    expect(wrapper.findAll('button').some((button) => button.text().includes('Download CSV'))).toBe(true)
  })

  it('emits set-range when a range button is clicked', async () => {
    const wrapper = mountChart({ series, range: '1Y', state: 'ready' })
    await wrapper.findAll('button').find((button) => button.text() === '5Y').trigger('click')
    expect(wrapper.emitted('set-range')[0]).toEqual(['5Y'])
  })

  it('shows a loading placeholder', () => {
    const wrapper = mountChart({ state: 'loading' })
    expect(wrapper.text()).toContain('Loading rate history')
    expect(wrapper.find('polyline').exists()).toBe(false)
  })

  it('shows an error state with a retry action', async () => {
    const wrapper = mountChart({ state: 'error', errorMessage: 'Historical rates are unavailable right now.' })
    expect(wrapper.get('[role="alert"]').text()).toContain('unavailable')
    await wrapper.get('[role="alert"] button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('explains an unsupported pair', () => {
    const wrapper = mountChart({ state: 'unsupported', base: 'USD', quote: 'USD' })
    expect(wrapper.text()).toContain('two different currencies')
  })
})
