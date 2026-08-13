import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { getDataSources } from '@/tools/data-sources/api'
import DataSourcesView from './DataSourcesView.vue'

vi.mock('@/tools/data-sources/api', () => ({ getDataSources: vi.fn() }))

const PIN = {
  datasetType: 'PIN',
  active: true,
  version: '2026-06-10',
  sourceUpdatedAt: '2026-06-10',
  importedAt: '2026-08-04 10:00:00',
  recordCount: 165616,
  exclusionCount: 0,
  source: {
    name: 'Department of Posts, Government of India via data.gov.in',
    url: 'https://data.gov.in/',
    license: 'Government Open Data License - India',
    licenseUrl: 'https://data.gov.in/government-open-data-license-india',
  },
}

async function render(response) {
  getDataSources.mockImplementation(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  const wrapper = mount(DataSourcesView)
  await new Promise((resolve) => setTimeout(resolve))
  return wrapper
}

describe('the data sources page', () => {
  it('names every dataset, and the tools that stand on it', async () => {
    const wrapper = await render({ schemaVersion: 1, datasets: [PIN] })

    for (const name of ['Indian post offices', 'Indian bank branches', 'English dictionary']) {
      expect(wrapper.text()).toContain(name)
    }
    expect(wrapper.text()).toContain('PIN Code Search')
  })

  it('shows the release facts the server reports', async () => {
    const wrapper = await render({ schemaVersion: 1, datasets: [PIN] })

    expect(wrapper.text()).toContain('2026-06-10')
    expect(wrapper.text()).toContain('165,616')
    expect(wrapper.text()).toContain('Government Open Data License - India')
  })

  it('says which dataset has no active release, rather than dropping it', async () => {
    const wrapper = await render({ schemaVersion: 1, datasets: [{ datasetType: 'HSN', active: false }] })

    expect(wrapper.text()).toContain('HSN and SAC codes')
    expect(wrapper.text()).toContain('No release is active on this site')
  })

  it('keeps the page standing when the server cannot be reached', async () => {
    // What each dataset is, and who publishes it, needs no connection to say.
    const wrapper = await render(new Error('offline'))

    expect(wrapper.text()).toContain('could not reach the server')
    expect(wrapper.text()).toContain('WordNet')
    expect(wrapper.text()).toContain('Indian post offices')
  })

  it('names the service called while a tool is used, and its refresh', async () => {
    const wrapper = await render({ schemaVersion: 1, datasets: [] })

    expect(wrapper.text()).toContain('European Central Bank')
    expect(wrapper.text()).toContain('every 6 hours')
    expect(wrapper.text()).toContain('Every other tool runs entirely in your browser')
  })
})
