import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { downloadJson, downloadTextFile } from '@/utils/fileExport'
import { SAVE_DEBOUNCE_MS, useChecklists } from './useChecklists'

vi.mock('@/utils/fileExport', () => ({
  downloadTextFile: vi.fn(() => true),
  downloadJson: vi.fn(() => true),
}))

// Echo a save payload back as a full checklist, the way the server does.
function echo(payload) {
  return {
    name: payload.name || 'CL-NEW',
    title: payload.title,
    description: payload.description || null,
    due_date: payload.due_date || null,
    is_pinned: Boolean(payload.is_pinned),
    is_archived: Boolean(payload.is_archived),
    move_completed_to_bottom: payload.move_completed_to_bottom !== false,
    source_template: null,
    tags: payload.tags || [],
    items: (payload.items || []).map((item, index) => ({
      item_text: item.item_text,
      is_completed: Boolean(item.is_completed),
      completed_at: item.is_completed ? '2026-08-04 00:00:00' : null,
      sort_order: index,
      note: item.note || null,
    })),
    creation: '2026-08-01 00:00:00',
    modified: '2026-08-04 12:00:00',
  }
}

function detail(overrides = {}) {
  return {
    name: 'CL-1',
    title: 'Trip packing',
    description: 'Weekend bag',
    due_date: null,
    is_pinned: false,
    is_archived: false,
    move_completed_to_bottom: false,
    source_template: null,
    tags: ['travel'],
    items: [
      { item_text: 'Passport', is_completed: false, completed_at: null, sort_order: 0, note: null },
      { item_text: 'Charger', is_completed: false, completed_at: null, sort_order: 1, note: null },
    ],
    creation: '2026-08-01 00:00:00',
    modified: '2026-08-04 00:00:00',
    ...overrides,
  }
}

function makeApi(overrides = {}) {
  return {
    listChecklists: vi.fn().mockResolvedValue([]),
    getChecklist: vi.fn().mockResolvedValue(detail()),
    saveChecklist: vi.fn().mockImplementation((data) => Promise.resolve(echo(data))),
    deleteChecklist: vi.fn().mockResolvedValue(null),
    duplicateChecklist: vi.fn(),
    listTemplates: vi.fn().mockResolvedValue([]),
    createChecklistFromTemplate: vi.fn().mockResolvedValue(detail({ title: 'Packing checklist' })),
    saveAsTemplate: vi.fn().mockResolvedValue({ name: 't1', template_name: 'Mine', is_system: false }),
    ...overrides,
  }
}

afterEach(() => vi.useRealTimers())

describe('useChecklists list and filtering', () => {
  const rows = [
    { name: 'A', title: 'Groceries', description: 'weekly', is_pinned: true, is_archived: false, tags: ['home'], total_items: 3, completed_items: 1 },
    { name: 'B', title: 'Sprint tasks', description: '', is_pinned: false, is_archived: false, tags: ['work'], total_items: 5, completed_items: 5 },
    { name: 'C', title: 'Old list', description: '', is_pinned: false, is_archived: true, tags: [], total_items: 2, completed_items: 0 },
  ]

  it('loads the list and hides archived unless requested', async () => {
    const checklist = useChecklists({ api: makeApi({ listChecklists: vi.fn().mockResolvedValue(rows) }) })
    await checklist.loadList()

    expect(checklist.state.value).toBe('ready')
    expect(checklist.checklists.value).toHaveLength(3)
    expect(checklist.filteredChecklists.value.map((row) => row.name)).toEqual(['A', 'B'])

    checklist.showArchived.value = true
    expect(checklist.filteredChecklists.value.map((row) => row.name)).toEqual(['A', 'B', 'C'])
  })

  it('searches across title, description, and tags', async () => {
    const checklist = useChecklists({ api: makeApi({ listChecklists: vi.fn().mockResolvedValue(rows) }) })
    await checklist.loadList()

    checklist.searchQuery.value = 'WORK'
    expect(checklist.filteredChecklists.value.map((row) => row.name)).toEqual(['B'])

    checklist.searchQuery.value = 'weekly'
    expect(checklist.filteredChecklists.value.map((row) => row.name)).toEqual(['A'])
  })

  it('reports an error state when the list fails to load', async () => {
    const checklist = useChecklists({ api: makeApi({ listChecklists: vi.fn().mockRejectedValue(new Error('offline')) }) })
    await checklist.loadList()

    expect(checklist.state.value).toBe('error')
    expect(checklist.errorMessage.value).not.toBe('')
  })
})

describe('useChecklists active checklist editing', () => {
  it('creates an empty checklist and opens it', async () => {
    const api = makeApi()
    const checklist = useChecklists({ api })
    await checklist.createChecklist()

    expect(api.saveChecklist).toHaveBeenCalledTimes(1)
    expect(checklist.activeChecklist.value.name).toBe('CL-NEW')
    expect(checklist.activeChecklist.value.items).toEqual([])
    expect(checklist.checklists.value).toHaveLength(1)
  })

  it('toggles an item and re-persists the change', async () => {
    const api = makeApi()
    const checklist = useChecklists({ api })
    await checklist.openChecklist('CL-1')

    checklist.toggleItem(0)
    await flushPromises()

    expect(checklist.activeChecklist.value.items[0].is_completed).toBe(true)
    expect(checklist.activeChecklist.value.items[0].completed_at).not.toBeNull()
    expect(api.saveChecklist).toHaveBeenCalledTimes(1)
    const sentItems = api.saveChecklist.mock.calls[0][0].items
    expect(sentItems[0]).toMatchObject({ item_text: 'Passport', is_completed: true })
  })

  it('reorders items with moveItem', async () => {
    const api = makeApi()
    const checklist = useChecklists({ api })
    await checklist.openChecklist('CL-1')

    checklist.moveItem(0, 1)
    await flushPromises()

    expect(checklist.displayItems.value.map((item) => item.item_text)).toEqual(['Charger', 'Passport'])
    const sentItems = api.saveChecklist.mock.calls.at(-1)[0].items
    expect(sentItems.map((item) => item.item_text)).toEqual(['Charger', 'Passport'])
  })

  it('clears completed items and resets all items', async () => {
    const api = makeApi()
    const checklist = useChecklists({ api })
    await checklist.openChecklist('CL-1')

    checklist.toggleItem(0)
    await flushPromises()
    checklist.clearCompleted()
    await flushPromises()
    expect(checklist.activeChecklist.value.items.map((item) => item.item_text)).toEqual(['Charger'])

    checklist.toggleItem(0)
    await flushPromises()
    expect(checklist.activeChecklist.value.items[0].is_completed).toBe(true)
    checklist.resetAll()
    await flushPromises()
    expect(checklist.activeChecklist.value.items.every((item) => !item.is_completed)).toBe(true)
  })

  it('orders incomplete items first in displayItems when move-completed-to-bottom is on', async () => {
    const api = makeApi({
      getChecklist: vi.fn().mockResolvedValue(
        detail({
          move_completed_to_bottom: true,
          items: [
            { item_text: 'A', is_completed: false, sort_order: 0 },
            { item_text: 'B', is_completed: true, sort_order: 1 },
            { item_text: 'C', is_completed: false, sort_order: 2 },
            { item_text: 'D', is_completed: true, sort_order: 3 },
          ],
        }),
      ),
    })
    const checklist = useChecklists({ api })
    await checklist.openChecklist('CL-1')

    expect(checklist.displayItems.value.map((item) => item.item_text)).toEqual(['A', 'C', 'B', 'D'])
  })

  it('computes progress totals and percent', async () => {
    const api = makeApi({
      getChecklist: vi.fn().mockResolvedValue(
        detail({
          items: [
            { item_text: 'A', is_completed: true },
            { item_text: 'B', is_completed: false },
            { item_text: 'C', is_completed: false },
            { item_text: 'D', is_completed: false },
          ],
        }),
      ),
    })
    const checklist = useChecklists({ api })
    await checklist.openChecklist('CL-1')

    expect(checklist.progress.value).toEqual({ total: 4, completed: 1, percent: 25 })
  })

  it('debounces text edits into a single save', async () => {
    vi.useFakeTimers()
    const api = makeApi()
    const checklist = useChecklists({ api })
    await checklist.openChecklist('CL-1')

    checklist.setTitle('Packing v2')
    checklist.setTitle('Packing v3')
    expect(api.saveChecklist).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(api.saveChecklist).toHaveBeenCalledTimes(1)
    expect(api.saveChecklist.mock.calls[0][0].title).toBe('Packing v3')
  })

  it('keeps local edits and surfaces an error when a save fails', async () => {
    const api = makeApi({ saveChecklist: vi.fn().mockRejectedValue(new Error('boom')) })
    const checklist = useChecklists({ api })
    await checklist.openChecklist('CL-1')

    checklist.toggleItem(0)
    await flushPromises()

    expect(checklist.saveError.value).not.toBe('')
    expect(checklist.activeChecklist.value.items[0].is_completed).toBe(true)
  })
})

describe('useChecklists export', () => {
  it('exports Markdown with checked and unchecked lines', async () => {
    const api = makeApi({
      getChecklist: vi.fn().mockResolvedValue(
        detail({
          title: 'Groceries',
          items: [
            { item_text: 'Milk', is_completed: true },
            { item_text: 'Eggs', is_completed: false },
          ],
        }),
      ),
    })
    const checklist = useChecklists({ api })
    await checklist.openChecklist('CL-1')

    checklist.exportMarkdown()
    expect(downloadTextFile).toHaveBeenCalledTimes(1)
    const [filename, contents] = downloadTextFile.mock.calls[0]
    expect(filename).toBe('groceries.md')
    expect(contents).toContain('# Groceries')
    expect(contents).toContain('- [x] Milk')
    expect(contents).toContain('- [ ] Eggs')
  })

  it('exports the full checklist as JSON', async () => {
    const checklist = useChecklists({ api: makeApi() })
    await checklist.openChecklist('CL-1')

    checklist.exportJson()
    expect(downloadJson).toHaveBeenCalledTimes(1)
    expect(downloadJson.mock.calls[0][1]).toMatchObject({ name: 'CL-1', title: 'Trip packing' })
  })
})

describe('useChecklists templates', () => {
  it('loads system and personal templates on demand', async () => {
    const rows = [
      { name: 't1', template_name: 'Packing checklist', is_system: true, item_count: 10 },
      { name: 't2', template_name: 'Mine', is_system: false, item_count: 3 },
    ]
    const checklist = useChecklists({ api: makeApi({ listTemplates: vi.fn().mockResolvedValue(rows) }) })
    await checklist.loadTemplates()
    expect(checklist.templates.value).toHaveLength(2)
    expect(checklist.templates.value[0].template_name).toBe('Packing checklist')
  })

  it('creates a checklist from a template and opens it', async () => {
    const api = makeApi({
      createChecklistFromTemplate: vi
        .fn()
        .mockResolvedValue(detail({ name: 'CL-9', title: 'Packing checklist' })),
    })
    const checklist = useChecklists({ api })
    await checklist.createFromTemplate('t1')
    expect(api.createChecklistFromTemplate).toHaveBeenCalledWith('t1')
    expect(checklist.activeChecklist.value.name).toBe('CL-9')
    expect(checklist.checklists.value.some((row) => row.name === 'CL-9')).toBe(true)
  })

  it('saves the active checklist as a personal template and refreshes the list', async () => {
    const api = makeApi()
    const checklist = useChecklists({ api })
    await checklist.openChecklist('CL-1')
    const saved = await checklist.saveActiveAsTemplate('My template')
    expect(api.saveAsTemplate).toHaveBeenCalledWith('CL-1', 'My template')
    expect(saved).toMatchObject({ is_system: false })
    expect(api.listTemplates).toHaveBeenCalled()
  })
})
