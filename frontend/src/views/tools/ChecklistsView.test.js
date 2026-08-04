import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ChecklistsView from '@/views/tools/ChecklistsView.vue'

const preferences = vi.hoisted(() => ({
  isFavourite: vi.fn(() => false),
  toggleFavourite: vi.fn(),
  recordRecent: vi.fn(),
}))

vi.mock('@/composables/useToolboxPreferences', () => ({
  useToolboxPreferences: () => preferences,
}))

const api = vi.hoisted(() => ({
  listChecklists: vi.fn(),
  getChecklist: vi.fn(),
  saveChecklist: vi.fn(),
  deleteChecklist: vi.fn(),
  duplicateChecklist: vi.fn(),
}))

vi.mock('@/tools/checklists/api', () => api)

const rows = [
  { name: 'A', title: 'Groceries', description: '', due_date: null, is_pinned: true, is_archived: false, tags: [], modified: '', total_items: 3, completed_items: 1 },
  { name: 'B', title: 'Sprint tasks', description: '', due_date: null, is_pinned: false, is_archived: false, tags: [], modified: '', total_items: 2, completed_items: 0 },
]

const groceriesDetail = {
  name: 'A',
  title: 'Groceries',
  description: '',
  due_date: null,
  is_pinned: true,
  is_archived: false,
  move_completed_to_bottom: false,
  source_template: null,
  tags: [],
  items: [
    { item_text: 'Milk', is_completed: true, completed_at: null, sort_order: 0, note: null },
    { item_text: 'Eggs', is_completed: false, completed_at: null, sort_order: 1, note: null },
  ],
  creation: '',
  modified: '',
}

async function mountView() {
  const wrapper = mount(ChecklistsView, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('ChecklistsView', () => {
  it('records recent use and shows a friendly empty state with no checklists', async () => {
    api.listChecklists.mockResolvedValue([])
    const wrapper = await mountView()

    expect(preferences.recordRecent).toHaveBeenCalledWith('checklists')
    expect(wrapper.text()).toContain('No checklists yet')
    expect(wrapper.findAll('button').some((button) => button.text() === 'New checklist')).toBe(true)
  })

  it('renders a loaded list with titles and progress', async () => {
    api.listChecklists.mockResolvedValue(rows)
    const wrapper = await mountView()

    expect(wrapper.get('[data-checklist-name="A"]').text()).toContain('Groceries')
    expect(wrapper.get('[data-checklist-name="A"]').text()).toContain('1/3')
    expect(wrapper.get('[data-checklist-name="B"]').text()).toContain('Sprint tasks')
  })

  it('opens a checklist and shows its items', async () => {
    api.listChecklists.mockResolvedValue(rows)
    api.getChecklist.mockResolvedValue(groceriesDetail)
    const wrapper = await mountView()

    await wrapper.get('[data-checklist-name="A"]').trigger('click')
    await flushPromises()

    expect(api.getChecklist).toHaveBeenCalledWith('A')
    expect(wrapper.find('input[aria-label="Mark Milk complete"]').exists()).toBe(true)
    expect(wrapper.find('input[aria-label="Mark Eggs complete"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('of 2 complete')
  })
})
