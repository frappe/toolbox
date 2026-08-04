import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import NotesView from '@/views/tools/NotesView.vue'

const preferences = vi.hoisted(() => ({
  isFavourite: vi.fn(() => false),
  toggleFavourite: vi.fn(),
  recordRecent: vi.fn(),
}))

vi.mock('@/composables/useToolboxPreferences', () => ({
  useToolboxPreferences: () => preferences,
}))

const api = vi.hoisted(() => ({
  listNotes: vi.fn(),
  getNote: vi.fn(),
  saveNote: vi.fn(),
  deleteNote: vi.fn(),
  duplicateNote: vi.fn(),
}))

vi.mock('@/tools/notes/api', () => api)

const rows = [
  { name: 'A', title: 'Groceries', excerpt: 'buy milk and eggs', is_pinned: true, is_archived: false, tags: [], modified: '' },
  { name: 'B', title: 'Sprint notes', excerpt: 'ship the feature', is_pinned: false, is_archived: false, tags: [], modified: '' },
]

const groceriesDetail = {
  name: 'A',
  title: 'Groceries',
  content_html: '<p>Buy milk and eggs</p>',
  content_json: null,
  search_text: 'Buy milk and eggs',
  is_pinned: true,
  is_archived: false,
  tags: [],
  creation: '',
  modified: '',
}

async function mountView() {
  const wrapper = mount(NotesView, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('NotesView', () => {
  it('records recent use and shows a friendly empty state with no notes', async () => {
    api.listNotes.mockResolvedValue([])
    const wrapper = await mountView()

    expect(preferences.recordRecent).toHaveBeenCalledWith('notes')
    expect(wrapper.text()).toContain('No notes yet')
    expect(wrapper.findAll('button').some((button) => button.text() === 'New note')).toBe(true)
  })

  it('renders a loaded list with titles and excerpts', async () => {
    api.listNotes.mockResolvedValue(rows)
    const wrapper = await mountView()

    expect(wrapper.get('[data-note-name="A"]').text()).toContain('Groceries')
    expect(wrapper.get('[data-note-name="A"]').text()).toContain('buy milk and eggs')
    expect(wrapper.get('[data-note-name="B"]').text()).toContain('Sprint notes')
  })

  it('opens a note and shows its title and editor', async () => {
    api.listNotes.mockResolvedValue(rows)
    api.getNote.mockResolvedValue(groceriesDetail)
    const wrapper = await mountView()

    await wrapper.get('[data-note-name="A"]').trigger('click')
    await flushPromises()

    expect(api.getNote).toHaveBeenCalledWith('A')
    expect(wrapper.get('#note-title').element.value).toBe('Groceries')
    // frappe-ui is mocked without TextEditor, so the contenteditable fallback renders.
    expect(wrapper.find('[role="textbox"]').exists()).toBe(true)
    expect(wrapper.findAll('button').some((button) => button.text() === 'Duplicate')).toBe(true)
  })
})
