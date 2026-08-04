import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import LibraryView from '@/views/tools/LibraryView.vue'

const preferences = vi.hoisted(() => ({
  isFavourite: vi.fn(() => false),
  toggleFavourite: vi.fn(),
  recordRecent: vi.fn(),
}))

vi.mock('@/composables/useToolboxPreferences', () => ({
  useToolboxPreferences: () => preferences,
}))

const api = vi.hoisted(() => ({
  listLinks: vi.fn(),
  listCollections: vi.fn(),
  getLink: vi.fn(),
  saveLink: vi.fn(),
  deleteLink: vi.fn(),
  setStatus: vi.fn(),
  toggleFavourite: vi.fn(),
  saveCollection: vi.fn(),
  deleteCollection: vi.fn(),
  exportLinks: vi.fn(),
}))

vi.mock('@/tools/library/api', () => api)

const rows = [
  { name: 'A', url: 'https://example.com/a', title: 'Example A', domain: 'example.com', status: 'Inbox', is_favourite: false, tags: ['news'], collection: '' },
  { name: 'B', url: 'https://example.com/b', title: 'Example B', domain: 'example.com', status: 'Read', is_favourite: true, tags: [], collection: 'Work' },
]

async function mountView() {
  const wrapper = mount(LibraryView, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('LibraryView', () => {
  it('records recent use and shows an empty state with no links', async () => {
    api.listLinks.mockResolvedValue([])
    api.listCollections.mockResolvedValue([])
    const wrapper = await mountView()

    expect(preferences.recordRecent).toHaveBeenCalledWith('library')
    expect(wrapper.text()).toContain('No links yet')
  })

  it('always offers a save form with a URL field', async () => {
    api.listLinks.mockResolvedValue([])
    api.listCollections.mockResolvedValue([])
    const wrapper = await mountView()

    expect(wrapper.find('input[aria-label="Link URL"]').exists()).toBe(true)
    expect(wrapper.findAll('button').some((button) => button.text() === 'Save link')).toBe(true)
  })

  it('renders a loaded list with titles and status', async () => {
    api.listLinks.mockResolvedValue(rows)
    api.listCollections.mockResolvedValue([])
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Example A')
    expect(wrapper.text()).toContain('Example B')
  })
})
