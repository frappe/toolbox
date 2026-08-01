import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import HsnResultList from './HsnResultList.vue'

describe('HsnResultList', () => {
  it('keeps the GST handoff unavailable when the source has no statutory rate', () => {
    const wrapper = mountList([{ code: '0101', description: 'Live horses' }])

    expect(wrapper.text()).toContain('Statutory GST rate is not available')
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('links a contract-provided rate to the GST Calculator', () => {
    const wrapper = mountList([{ code: '998313', description: 'IT services', gstRate: 18 }])

    expect(wrapper.get('a').attributes('to')).toBe('/gst-calculator?rate=18')
    expect(wrapper.text()).toContain('Use 18% in GST Calculator')
  })
})

function mountList(results) {
  return mount(HsnResultList, {
    props: { query: 'service', results },
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a :to="to"><slot /></a>',
        },
      },
    },
  })
}
