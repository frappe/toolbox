import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { downloadTextFile } from '@/utils/fileExport'
import { SAVE_DEBOUNCE_MS, useNotes } from './useNotes'

vi.mock('@/utils/fileExport', () => ({
  downloadTextFile: vi.fn(() => true),
  downloadJson: vi.fn(() => true),
}))

// Echo a save payload back as a full note, the way the server does, deriving a plain-text
// search index from the content HTML.
function echo(payload) {
  const html = payload.content_html || ''
  return {
    name: payload.name || 'NOTE-NEW',
    title: payload.title,
    content_html: html,
    content_json: payload.content_json || null,
    search_text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    is_pinned: Boolean(payload.is_pinned),
    is_archived: Boolean(payload.is_archived),
    tags: payload.tags || [],
    creation: '2026-08-01 00:00:00',
    modified: '2026-08-04 12:00:00',
  }
}

function detail(overrides = {}) {
  return {
    name: 'NOTE-1',
    title: 'Trip ideas',
    content_html: '<p>Book flights</p>',
    content_json: null,
    search_text: 'Book flights',
    is_pinned: false,
    is_archived: false,
    tags: ['travel'],
    creation: '2026-08-01 00:00:00',
    modified: '2026-08-04 00:00:00',
    ...overrides,
  }
}

function makeApi(overrides = {}) {
  return {
    listNotes: vi.fn().mockResolvedValue([]),
    getNote: vi.fn().mockResolvedValue(detail()),
    saveNote: vi.fn().mockImplementation((data) => Promise.resolve(echo(data))),
    deleteNote: vi.fn().mockResolvedValue(null),
    duplicateNote: vi.fn(),
    ...overrides,
  }
}

afterEach(() => vi.useRealTimers())

describe('useNotes list and filtering', () => {
  const rows = [
    { name: 'A', title: 'Groceries', excerpt: 'buy milk and eggs', is_pinned: true, is_archived: false, tags: ['home'] },
    { name: 'B', title: 'Sprint tasks', excerpt: 'ship the feature', is_pinned: false, is_archived: false, tags: ['work'] },
    { name: 'C', title: 'Old note', excerpt: 'archived stuff', is_pinned: false, is_archived: true, tags: [] },
  ]

  it('loads the list and hides archived unless requested', async () => {
    const notes = useNotes({ api: makeApi({ listNotes: vi.fn().mockResolvedValue(rows) }) })
    await notes.loadList()

    expect(notes.state.value).toBe('ready')
    expect(notes.notes.value).toHaveLength(3)
    expect(notes.filteredNotes.value.map((row) => row.name)).toEqual(['A', 'B'])

    notes.showArchived.value = true
    expect(notes.filteredNotes.value.map((row) => row.name)).toEqual(['A', 'B', 'C'])
  })

  it('searches across title, content excerpt, and tags', async () => {
    const notes = useNotes({ api: makeApi({ listNotes: vi.fn().mockResolvedValue(rows) }) })
    await notes.loadList()

    notes.searchQuery.value = 'WORK'
    expect(notes.filteredNotes.value.map((row) => row.name)).toEqual(['B'])

    notes.searchQuery.value = 'milk'
    expect(notes.filteredNotes.value.map((row) => row.name)).toEqual(['A'])

    notes.searchQuery.value = 'groceries'
    expect(notes.filteredNotes.value.map((row) => row.name)).toEqual(['A'])
  })

  it('reports an error state when the list fails to load', async () => {
    const notes = useNotes({ api: makeApi({ listNotes: vi.fn().mockRejectedValue(new Error('offline')) }) })
    await notes.loadList()

    expect(notes.state.value).toBe('error')
    expect(notes.errorMessage.value).not.toBe('')
  })
})

describe('useNotes active note editing', () => {
  it('creates an empty note and opens it', async () => {
    const api = makeApi()
    const notes = useNotes({ api })
    await notes.createNote()

    expect(api.saveNote).toHaveBeenCalledTimes(1)
    expect(notes.activeNote.value.name).toBe('NOTE-NEW')
    expect(notes.activeNote.value.content_html).toBe('')
    expect(notes.notes.value).toHaveLength(1)
  })

  it('debounces content edits into a single save', async () => {
    vi.useFakeTimers()
    const api = makeApi()
    const notes = useNotes({ api })
    await notes.openNote('NOTE-1')

    notes.setContentHtml('<p>v2</p>')
    notes.setContentHtml('<p>v3</p>')
    expect(api.saveNote).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(api.saveNote).toHaveBeenCalledTimes(1)
    expect(api.saveNote.mock.calls[0][0].content_html).toBe('<p>v3</p>')
  })

  it('keeps local edits and surfaces an error when an autosave fails', async () => {
    vi.useFakeTimers()
    const api = makeApi({ saveNote: vi.fn().mockRejectedValue(new Error('boom')) })
    const notes = useNotes({ api })
    await notes.openNote('NOTE-1')

    notes.setContentHtml('<p>unsaved work</p>')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)

    expect(notes.saveError.value).not.toBe('')
    expect(notes.activeNote.value.content_html).toBe('<p>unsaved work</p>')
  })

  it('toggles pin and re-persists immediately', async () => {
    const api = makeApi()
    const notes = useNotes({ api })
    await notes.openNote('NOTE-1')

    notes.togglePin()
    await flushPromises()

    expect(notes.activeNote.value.is_pinned).toBe(true)
    expect(api.saveNote).toHaveBeenCalledTimes(1)
    expect(api.saveNote.mock.calls[0][0].is_pinned).toBe(true)
  })

  it('archives the active note and persists it', async () => {
    const api = makeApi()
    const notes = useNotes({ api })
    await notes.openNote('NOTE-1')

    notes.toggleArchive()
    await flushPromises()

    expect(notes.activeNote.value.is_archived).toBe(true)
    expect(api.saveNote.mock.calls.at(-1)[0].is_archived).toBe(true)
  })

  it('sets tags and persists them', async () => {
    const api = makeApi()
    const notes = useNotes({ api })
    await notes.openNote('NOTE-1')

    notes.setTags(['work', 'urgent'])
    await flushPromises()

    expect(notes.activeNote.value.tags).toEqual(['work', 'urgent'])
    expect(api.saveNote.mock.calls.at(-1)[0].tags).toEqual(['work', 'urgent'])
  })

  it('deletes the active note and drops it from the list', async () => {
    const api = makeApi({
      listNotes: vi.fn().mockResolvedValue([
        { name: 'NOTE-1', title: 'Trip ideas', excerpt: '', is_pinned: false, is_archived: false, tags: [] },
      ]),
    })
    const notes = useNotes({ api })
    await notes.loadList()
    await notes.openNote('NOTE-1')

    await notes.deleteActive()

    expect(api.deleteNote).toHaveBeenCalledWith('NOTE-1')
    expect(notes.activeNote.value).toBeNull()
    expect(notes.notes.value.map((row) => row.name)).not.toContain('NOTE-1')
  })

  it('duplicates the active note into a new list entry', async () => {
    const api = makeApi({
      duplicateNote: vi.fn().mockResolvedValue(
        echo({ name: 'NOTE-2', title: 'Trip ideas (copy)', content_html: '<p>Book flights</p>' }),
      ),
    })
    const notes = useNotes({ api })
    await notes.openNote('NOTE-1')

    await notes.duplicateActive()

    expect(api.duplicateNote).toHaveBeenCalledWith('NOTE-1')
    expect(notes.activeNote.value.name).toBe('NOTE-2')
    expect(notes.notes.value.some((row) => row.name === 'NOTE-2')).toBe(true)
  })
})

describe('useNotes export', () => {
  it('exports Markdown with a title heading and a plain-text body', async () => {
    const api = makeApi({
      getNote: vi.fn().mockResolvedValue(
        detail({ title: 'Groceries', content_html: '<p>Buy milk</p><p>Buy eggs</p>' }),
      ),
    })
    const notes = useNotes({ api })
    await notes.openNote('NOTE-1')

    notes.exportMarkdown()
    expect(downloadTextFile).toHaveBeenCalledTimes(1)
    const [filename, contents, mime] = downloadTextFile.mock.calls[0]
    expect(filename).toBe('groceries.md')
    expect(contents).toContain('# Groceries')
    expect(contents).toContain('Buy milk')
    expect(contents).toContain('Buy eggs')
    expect(contents).not.toContain('<p>')
    expect(mime).toBe('text/markdown')
  })

  it('exports HTML wrapping the note content', async () => {
    const api = makeApi({
      getNote: vi.fn().mockResolvedValue(detail({ title: 'Groceries', content_html: '<p>Buy milk</p>' })),
    })
    const notes = useNotes({ api })
    await notes.openNote('NOTE-1')

    notes.exportHtml()
    expect(downloadTextFile).toHaveBeenCalledTimes(1)
    const [filename, contents, mime] = downloadTextFile.mock.calls[0]
    expect(filename).toBe('groceries.html')
    expect(contents).toContain('<h1>Groceries</h1>')
    expect(contents).toContain('<p>Buy milk</p>')
    expect(mime).toBe('text/html')
  })
})
