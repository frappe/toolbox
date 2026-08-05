import { describe, expect, it, vi } from 'vitest'

import { formatDuration, formatSize, useAudioLibrary } from './useAudioLibrary'

function makeApi(overrides = {}) {
  return {
    listRecordings: vi.fn(async () => []),
    saveRecording: vi.fn(async (data) => ({ name: 'A1', title: data.title, container_format: 'wav', file: '/private/files/a.wav' })),
    updateRecording: vi.fn(async (data) => ({ name: data.name, title: data.title })),
    deleteRecording: vi.fn(async () => {}),
    ...overrides,
  }
}

const fakeReadBlob = vi.fn(async () => 'data:audio/wav;base64,AAAA')

describe('useAudioLibrary', () => {
  it('loads recordings and reports ready', async () => {
    const api = makeApi({ listRecordings: vi.fn(async () => [{ name: 'A1', title: 'Memo' }]) })
    const lib = useAudioLibrary({ api, readBlob: fakeReadBlob })
    await lib.load()
    expect(lib.state.value).toBe('ready')
    expect(lib.recordings.value).toHaveLength(1)
    expect(lib.isEmpty.value).toBe(false)
  })

  it('reports an error when loading fails', async () => {
    const api = makeApi({ listRecordings: vi.fn(async () => { throw new Error('offline') }) })
    const lib = useAudioLibrary({ api, readBlob: fakeReadBlob })
    await lib.load()
    expect(lib.state.value).toBe('error')
    expect(lib.errorMessage.value).toBe('offline')
  })

  it('saves a blob as base64 and prepends the result', async () => {
    const api = makeApi()
    const lib = useAudioLibrary({ api, readBlob: fakeReadBlob })
    const saved = await lib.saveBlob({ size: 12 }, { title: 'Note one', durationSeconds: 4 })
    expect(fakeReadBlob).toHaveBeenCalled()
    expect(api.saveRecording).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Note one', data: 'data:audio/wav;base64,AAAA', duration_seconds: 4 }),
    )
    expect(lib.recordings.value[0]).toEqual(saved)
  })

  it('refuses to save an empty blob', async () => {
    const api = makeApi()
    const lib = useAudioLibrary({ api, readBlob: fakeReadBlob })
    expect(await lib.saveBlob({ size: 0 }, { title: 'x' })).toBeNull()
    expect(api.saveRecording).not.toHaveBeenCalled()
    expect(lib.saveError.value).toContain('nothing recorded')
  })

  it('renames and removes recordings', async () => {
    const api = makeApi({ listRecordings: vi.fn(async () => [{ name: 'A1', title: 'Old' }]) })
    const lib = useAudioLibrary({ api, readBlob: fakeReadBlob })
    await lib.load()
    await lib.rename('A1', 'New')
    expect(lib.recordings.value[0].title).toBe('New')
    await lib.remove('A1')
    expect(lib.recordings.value).toHaveLength(0)
  })

  it('updates title, category and tags together', async () => {
    const api = makeApi({
      listRecordings: vi.fn(async () => [{ name: 'A1', title: 'Old', category: 'Notes', tags: ['a'] }]),
      updateRecording: vi.fn(async (data) => ({ name: data.name, title: data.title, category: data.category, tags: data.tags })),
    })
    const lib = useAudioLibrary({ api, readBlob: fakeReadBlob })
    await lib.load()
    const ok = await lib.update('A1', { title: 'New', category: 'Ideas', tags: ['x', 'y'] })
    expect(ok).toBe(true)
    expect(api.updateRecording).toHaveBeenCalledWith({ name: 'A1', title: 'New', category: 'Ideas', tags: ['x', 'y'] })
    expect(lib.recordings.value[0]).toMatchObject({ title: 'New', category: 'Ideas', tags: ['x', 'y'] })
  })

  it('saves category and tags with a recording', async () => {
    const api = makeApi()
    const lib = useAudioLibrary({ api, readBlob: fakeReadBlob })
    await lib.saveBlob({ size: 12 }, { title: 'Note', durationSeconds: 2, category: 'Memo', tags: ['work'] })
    expect(api.saveRecording).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Memo', tags: ['work'] }),
    )
  })
})

describe('audio format helpers', () => {
  it('formats duration as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(75)).toBe('1:15')
  })

  it('formats byte sizes', () => {
    expect(formatSize(500)).toBe('500 B')
    expect(formatSize(2048)).toBe('2 KB')
    expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})
