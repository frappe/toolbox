import { describe, expect, it, vi } from 'vitest'

import { HSN_SOURCE_URL } from './snapshotStore'
import { useHsnLookup } from './useHsnLookup'

const catalog = {
  schemaVersion: 1,
  revision: 'a'.repeat(64),
  sourceVersion: '17.1.0',
  sourceModifiedAt: '2026-07-31T12:00:00+00:00',
  recordCount: 2,
  records: [
    { code: '0101', description: 'Live horses' },
    { code: '998313', description: 'Information technology services' },
  ],
  source: { name: 'India Compliance GST HSN Code', url: HSN_SOURCE_URL },
}
const ready = { schemaVersion: 1, state: 'ready', title: 'Ready', message: 'Ready' }
const blocked = { schemaVersion: 1, state: 'blocked', title: 'Required', message: 'Ask an administrator' }

describe('HSN lookup orchestration', () => {
  it('loads the live catalog, saves it, and searches locally', async () => {
    const store = memoryStore()
    const request = routeRequest({ dependency: ready, catalog })
    const lookup = useHsnLookup({ request, snapshotStore: store })

    await lookup.initialize()
    lookup.query.value = 'technology'

    expect(lookup.loadState.value).toBe('ready')
    expect(lookup.results.value[0].code).toBe('998313')
    expect(store.save).toHaveBeenCalledOnce()
  })

  it('uses an existing snapshot offline without replacing it', async () => {
    const store = memoryStore(snapshot())
    const lookup = useHsnLookup({ request: vi.fn().mockRejectedValue(new Error('offline')), snapshotStore: store })

    await lookup.initialize()
    lookup.query.value = '0101'

    expect(lookup.loadState.value).toBe('offline')
    expect(lookup.canSearch.value).toBe(true)
    expect(lookup.results.value[0].code).toBe('0101')
    expect(store.save).not.toHaveBeenCalled()
  })

  it('keeps a snapshot behind the dependency gate until the user selects it', async () => {
    const lookup = useHsnLookup({
      request: routeRequest({ dependency: blocked }),
      snapshotStore: memoryStore(snapshot()),
    })

    await lookup.initialize()
    expect(lookup.dependency.value.state).toBe('blocked')
    expect(lookup.loadState.value).toBe('stale')

    lookup.useSavedSnapshot()
    expect(lookup.dependency.value.state).toBe('ready')
    expect(lookup.canSearch.value).toBe(true)
  })

  it('preserves the prior snapshot when a refresh is interrupted', async () => {
    const request = routeRequest({ dependency: ready, catalogError: true })
    const store = memoryStore(snapshot())
    const lookup = useHsnLookup({ request, snapshotStore: store })

    await lookup.initialize()

    expect(lookup.loadState.value).toBe('stale')
    expect(lookup.catalog.value.revision).toBe(catalog.revision)
    expect(store.save).not.toHaveBeenCalled()
  })

  it('keeps online search available when browser snapshot storage is blocked', async () => {
    const store = memoryStore()
    store.save.mockResolvedValue(null)
    const lookup = useHsnLookup({
      request: routeRequest({ dependency: ready, catalog }),
      snapshotStore: store,
    })

    await lookup.initialize()

    expect(lookup.canSearch.value).toBe(true)
    expect(lookup.snapshotRefreshedAt.value).toBe('')
    expect(lookup.errorMessage.value).toContain('could not save an offline snapshot')
  })

  it('retries a failed dependency check', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce(blocked)
    const lookup = useHsnLookup({ request, snapshotStore: memoryStore() })

    await lookup.initialize()
    expect(lookup.dependency.value.state).toBe('failed')

    await lookup.retry()
    expect(lookup.dependency.value.state).toBe('blocked')
    expect(lookup.loadState.value).toBe('dependency')
  })

  it('requires confirmation, starts a cloud install, and polls its task', async () => {
    let pollCallback
    const request = routeRequest({
      dependency: {
        schemaVersion: 1,
        state: 'installable',
        title: 'Installable',
        message: 'Confirm',
      },
      install: {
        schemaVersion: 1,
        state: 'installing',
        title: 'Installing',
        message: 'Running',
        taskId: 'task-1',
      },
      task: ready,
      catalog,
    })
    const lookup = useHsnLookup({
      request,
      snapshotStore: memoryStore(),
      setTimer: (callback) => {
        pollCallback = callback
        return 1
      },
      clearTimer: vi.fn(),
    })

    await lookup.initialize()
    await lookup.install()
    expect(request.mock.calls.some(([options]) => options.method === 'POST')).toBe(false)

    lookup.installConfirmed.value = true
    await lookup.install()
    expect(lookup.dependency.value.state).toBe('installing')
    await pollCallback()
    expect(lookup.dependency.value.state).toBe('ready')
  })
})

function memoryStore(initial = null) {
  return {
    load: vi.fn().mockResolvedValue(initial),
    save: vi.fn(async (data) => ({
      schemaVersion: 1,
      snapshotRefreshedAt: '2026-08-01T01:00:00.000Z',
      data,
    })),
  }
}

function snapshot() {
  return {
    schemaVersion: 1,
    snapshotRefreshedAt: '2026-08-01T01:00:00.000Z',
    data: catalog,
  }
}

function routeRequest({ dependency, catalog: catalogResponse, install, task, catalogError = false }) {
  return vi.fn(async ({ url, method, params }) => {
    if (url.endsWith('install_india_compliance') && method === 'POST') return install
    if (url.endsWith('get_dependency_status')) return params?.task_id ? task : dependency
    if (url.endsWith('get_hsn_catalog')) {
      if (catalogError) throw new Error('interrupted')
      return catalogResponse
    }
    throw new Error(`Unexpected request: ${url}`)
  })
}
