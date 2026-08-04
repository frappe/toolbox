import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/fileExport', () => ({
  downloadTextFile: vi.fn(() => true),
  downloadJson: vi.fn(() => true),
}))

import { downloadJson, downloadTextFile } from '@/utils/fileExport'
import { safeHref, useLibrary } from './useLibrary'

function link(overrides = {}) {
  return {
    name: 'L-1',
    url: 'https://example.com/a',
    normalised_url: 'https://example.com/a',
    title: 'Example A',
    description: '',
    site_name: '',
    domain: 'example.com',
    personal_note: '',
    collection: '',
    status: 'Inbox',
    is_favourite: false,
    tags: [],
    creation: '2026-08-01 00:00:00',
    modified: '2026-08-04 00:00:00',
    ...overrides,
  }
}

function makeApi(overrides = {}) {
  return {
    listLinks: vi.fn().mockResolvedValue([]),
    listCollections: vi.fn().mockResolvedValue([]),
    saveLink: vi.fn().mockImplementation((data) => Promise.resolve(link({ ...data, name: 'L-new' }))),
    deleteLink: vi.fn().mockResolvedValue(null),
    setStatus: vi.fn().mockImplementation((name, status) => Promise.resolve(link({ name, status }))),
    toggleFavourite: vi.fn().mockImplementation((name) => Promise.resolve(link({ name, is_favourite: true }))),
    saveCollection: vi.fn().mockResolvedValue({ name: 'C-1', collection_name: 'Work' }),
    deleteCollection: vi.fn().mockResolvedValue(null),
    exportLinks: vi.fn().mockResolvedValue({
      links: [link()],
      csv_columns: ['url', 'title'],
      csv_rows: [['https://example.com/a', 'Example A']],
    }),
    ...overrides,
  }
}

afterEach(() => vi.clearAllMocks())

describe('useLibrary', () => {
  it('loads links and collections', async () => {
    const api = makeApi({
      listLinks: vi.fn().mockResolvedValue([link()]),
      listCollections: vi.fn().mockResolvedValue([{ name: 'C-1', collection_name: 'Work' }]),
    })
    const lib = useLibrary({ api })
    await lib.loadList()
    expect(lib.state.value).toBe('ready')
    expect(lib.links.value).toHaveLength(1)
    expect(lib.collections.value).toHaveLength(1)
  })

  it('filters by status, favourites, and search', async () => {
    const api = makeApi({
      listLinks: vi.fn().mockResolvedValue([
        link({ name: 'a', title: 'Alpha', status: 'Inbox' }),
        link({ name: 'b', title: 'Beta', status: 'Read', is_favourite: true }),
      ]),
    })
    const lib = useLibrary({ api })
    await lib.loadList()
    lib.activeStatus.value = 'Read'
    expect(lib.filteredLinks.value.map((l) => l.title)).toEqual(['Beta'])
    lib.activeStatus.value = 'Favourites'
    expect(lib.filteredLinks.value.map((l) => l.title)).toEqual(['Beta'])
    lib.activeStatus.value = 'All'
    lib.searchQuery.value = 'alph'
    expect(lib.filteredLinks.value.map((l) => l.title)).toEqual(['Alpha'])
  })

  it('computes status counts from the full list', async () => {
    const api = makeApi({
      listLinks: vi.fn().mockResolvedValue([
        link({ name: 'a', status: 'Inbox' }),
        link({ name: 'b', status: 'Read', is_favourite: true }),
      ]),
    })
    const lib = useLibrary({ api })
    await lib.loadList()
    expect(lib.statusCounts.value.All).toBe(2)
    expect(lib.statusCounts.value.Read).toBe(1)
    expect(lib.statusCounts.value.Favourites).toBe(1)
  })

  it('requires a url before saving', async () => {
    const api = makeApi()
    const lib = useLibrary({ api })
    const result = await lib.saveForm()
    expect(result).toBeNull()
    expect(lib.formError.value).toMatch(/url/i)
    expect(api.saveLink).not.toHaveBeenCalled()
  })

  it('saves a link and adds it to the list', async () => {
    const api = makeApi()
    const lib = useLibrary({ api })
    lib.form.value.url = 'https://example.com/new'
    const saved = await lib.saveForm()
    expect(saved).toBeTruthy()
    expect(api.saveLink).toHaveBeenCalled()
    expect(lib.links.value.some((l) => l.name === 'L-new')).toBe(true)
  })

  it('surfaces a duplicate hint without adding a link', async () => {
    const api = makeApi({
      saveLink: vi.fn().mockResolvedValue({
        saved: false,
        duplicate_of: 'L-9',
        duplicate: link({ name: 'L-9' }),
        normalised_url: 'https://example.com/dup',
      }),
    })
    const lib = useLibrary({ api })
    lib.form.value.url = 'https://example.com/dup'
    const result = await lib.saveForm()
    expect(result).toBeNull()
    expect(lib.duplicateHint.value?.name).toBe('L-9')
    expect(lib.links.value).toHaveLength(0)
  })

  it('toggles favourite and changes status from the server response', async () => {
    const api = makeApi({ listLinks: vi.fn().mockResolvedValue([link({ name: 'a', is_favourite: false })]) })
    const lib = useLibrary({ api })
    await lib.loadList()
    await lib.toggleFavourite('a')
    expect(lib.links.value.find((l) => l.name === 'a').is_favourite).toBe(true)
    await lib.changeStatus('a', 'Read')
    expect(lib.links.value.find((l) => l.name === 'a').status).toBe('Read')
  })

  it('exports JSON and CSV', async () => {
    const lib = useLibrary({ api: makeApi() })
    await lib.exportJson()
    expect(downloadJson).toHaveBeenCalled()
    await lib.exportCsv()
    expect(downloadTextFile).toHaveBeenCalledWith(
      'library-links.csv',
      expect.stringContaining('https://example.com/a'),
      'text/csv',
    )
  })

  it('previews a JSON import and commits the new links', async () => {
    const api = makeApi()
    const lib = useLibrary({ api })
    const json = JSON.stringify([
      { url: 'https://example.com/one', title: 'One' },
      { url: 'https://example.com/two' },
    ])
    const preview = lib.previewImport(json, 'export.json')
    expect(preview.total).toBe(2)
    await lib.commitImport()
    expect(api.saveLink).toHaveBeenCalledTimes(2)
    expect(lib.importResult.value.imported).toBe(2)
  })

  it('never returns a dangerous href from safeHref', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('data:text/html,x')).toBeNull()
    expect(safeHref('https://example.com')).toBe('https://example.com')
    expect(safeHref('example.com/x')).toBe('https://example.com/x')
  })
})
