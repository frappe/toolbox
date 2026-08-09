import { describe, expect, it, vi } from 'vitest'

import {
  initializeToolboxPreferences,
  isLoggedInSession,
  retryToolboxPreferenceSync,
} from './toolboxPreferenceSync'
import { createDefaultPreferences, ToolboxPreferencesStore } from './useToolboxPreferences'

describe('toolbox preference synchronization', () => {
  it('persists only to the per-user server record (Toolbox is authenticated-only)', async () => {
    const store = new ToolboxPreferencesStore()
    const remote = createDefaultPreferences()
    const request = vi.fn().mockResolvedValue(remote)

    await initializeToolboxPreferences({ store, request })
    store.toggleHidden('calculator')

    expect(store.remoteSave).toBeTypeOf('function')
  })

  it('loads signed-in preferences from Frappe', async () => {
    const store = new ToolboxPreferencesStore()
    const remote = createDefaultPreferences()
    remote.hiddenToolIds = ['timer']
    const request = vi.fn().mockResolvedValue(remote)

    await initializeToolboxPreferences({
      store,
      request,
      session: { is_logged_in: true, user: 'person@example.com' },
    })

    expect(store.remoteSave).toBeTypeOf('function')
    expect(store.hiddenIds.value).toEqual(['timer'])
    expect(request).toHaveBeenCalledWith({
      url: expect.stringMatching(/\.get_preferences$/),
      method: 'GET',
    })
  })

  it('saves signed-in changes as semantic operations through the POST endpoint', async () => {
    const store = new ToolboxPreferencesStore()
    const request = vi
      .fn()
      .mockResolvedValueOnce(createDefaultPreferences())
      .mockImplementationOnce(({ params }) =>
        Promise.resolve(applyTestOperations(createDefaultPreferences(), params.payload)),
      )

    await initializeToolboxPreferences({
      store,
      request,
      session: { is_logged_in: true, user: 'person@example.com' },
    })
    store.toggleHidden('calculator')
    await store.flushRemoteSave()

    expect(request).toHaveBeenLastCalledWith({
      url: expect.stringMatching(/\.update_preferences$/),
      method: 'POST',
      params: {
        payload: {
          version: 1,
          operations: [{ type: 'setHidden', toolId: 'calculator', isHidden: true }],
        },
      },
    })
    expect(store.syncError.value).toBe('')
  })

  it('does not overwrite remote data when the initial load fails', async () => {
    const store = new ToolboxPreferencesStore()
    const request = vi.fn().mockRejectedValue(new Error('Offline'))

    await initializeToolboxPreferences({
      store,
      request,
      session: { is_logged_in: true, user: 'person@example.com' },
    })
    expect(store.isReady.value).toBe(true)
    expect(store.syncError.value).toContain('could not be loaded')

    store.toggleHidden('calculator')
    await expect(store.flushRemoteSave()).resolves.toBeNull()
    expect(request).toHaveBeenCalledTimes(1)
    expect(store.syncError.value).toContain('could not be loaded')
  })

  it('fails open after a bounded wait when preference loading stalls', async () => {
    const store = new ToolboxPreferencesStore()
    const request = vi.fn(() => new Promise(() => {}))

    await initializeToolboxPreferences({
      store,
      request,
      session: { is_logged_in: true, user: 'person@example.com' },
      loadTimeoutMs: 5,
    })

    expect(store.isReady.value).toBe(true)
    expect(store.remoteReady).toBe(false)
    expect(store.syncError.value).toContain('could not be loaded')
  })

  it('merges queued array operations with remote data after the initial load failed', async () => {
    const store = new ToolboxPreferencesStore()
    const remote = createDefaultPreferences()
    remote.hiddenToolIds = ['timer']
    remote.recentToolIds = ['world-clock']
    remote.settings.defaultCurrency = 'USD'
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(remote)
      .mockImplementationOnce(({ params }) =>
        Promise.resolve(applyTestOperations(remote, params.payload)),
      )

    await initializeToolboxPreferences({
      store,
      request,
      session: { is_logged_in: true, user: 'person@example.com' },
    })
    store.toggleHidden('calculator')
    store.recordRecent('calculator')
    store.updateSetting('temperatureUnit', 'fahrenheit')

    await retryToolboxPreferenceSync()
    await store.flushRemoteSave()

    expect(store.hiddenIds.value).toEqual(['timer', 'calculator'])
    expect(store.recentToolIds.value).toEqual(['calculator', 'world-clock'])
    expect(store.settings.defaultCurrency).toBe('USD')
    expect(store.settings.temperatureUnit).toBe('fahrenheit')
    expect(store.remoteReady).toBe(true)
    expect(store.syncError.value).toBe('')
    expect(request).toHaveBeenLastCalledWith({
      url: expect.stringMatching(/\.update_preferences$/),
      method: 'POST',
      params: {
        payload: {
          version: 1,
          operations: expect.arrayContaining([
            { type: 'setHidden', toolId: 'calculator', isHidden: true },
            { type: 'prependRecent', toolId: 'calculator' },
            { type: 'setSetting', key: 'temperatureUnit', value: 'fahrenheit' },
          ]),
        },
      },
    })
  })

  it('reports save failures', async () => {
    const store = new ToolboxPreferencesStore()
    const request = vi
      .fn()
      .mockResolvedValueOnce(createDefaultPreferences())
      .mockRejectedValueOnce(new Error('Offline'))

    await initializeToolboxPreferences({
      store,
      request,
      session: { is_logged_in: true, user: 'person@example.com' },
    })
    store.toggleHidden('calculator')
    await expect(store.flushRemoteSave()).resolves.toBeNull()

    expect(store.syncError.value).toContain('could not be saved')
  })

  it('retries a retained failed save after reconnect', async () => {
    const store = new ToolboxPreferencesStore()
    const request = vi
      .fn()
      .mockResolvedValueOnce(createDefaultPreferences())
      .mockRejectedValueOnce(new Error('Offline'))
      .mockImplementationOnce(({ params }) =>
        Promise.resolve(applyTestOperations(createDefaultPreferences(), params.payload)),
      )

    await initializeToolboxPreferences({
      store,
      request,
      session: { is_logged_in: true, user: 'person@example.com' },
    })
    store.toggleHidden('calculator')
    await store.flushRemoteSave()
    expect(store.syncError.value).toContain('could not be saved')

    await retryToolboxPreferenceSync()

    expect(store.syncError.value).toBe('')
    expect(store.pendingRemoteOperations).toEqual([])
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('times out a stalled save, restores its operations, and retries on reconnect', async () => {
    const store = new ToolboxPreferencesStore()
    const request = vi
      .fn()
      .mockResolvedValueOnce(createDefaultPreferences())
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementationOnce(({ params }) =>
        Promise.resolve(applyTestOperations(createDefaultPreferences(), params.payload)),
      )

    await initializeToolboxPreferences({
      store,
      request,
      session: { is_logged_in: true, user: 'person@example.com' },
      saveTimeoutMs: 5,
    })
    store.toggleHidden('calculator')

    await expect(store.flushRemoteSave()).resolves.toBeNull()

    expect(store.isSaving.value).toBe(false)
    expect(store.remoteSavePromise).toBeNull()
    expect(store.pendingRemoteOperations).toEqual([
      { type: 'setHidden', toolId: 'calculator', isHidden: true },
    ])
    expect(store.syncError.value).toContain('could not be saved')

    await retryToolboxPreferenceSync()

    expect(store.hiddenIds.value).toEqual(['calculator'])
    expect(store.pendingRemoteOperations).toEqual([])
    expect(store.syncError.value).toBe('')
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('keeps routes ready while a signed-in preference load is still pending', async () => {
    let finishLoad
    const store = new ToolboxPreferencesStore()
    const request = vi.fn(
      () =>
        new Promise((resolve) => {
          finishLoad = resolve
        }),
    )

    const initialization = initializeToolboxPreferences({
      store,
      request,
      session: { is_logged_in: true, user: 'person@example.com' },
    })

    expect(store.isReady.value).toBe(true)
    await Promise.resolve()
    finishLoad(createDefaultPreferences())
    await initialization
  })

  it('preserves an explicit recent clear while reconnecting to remote data', async () => {
    const remote = createDefaultPreferences()
    remote.recentToolIds = ['world-clock', 'calculator']
    const store = new ToolboxPreferencesStore()
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(remote)
      .mockImplementationOnce(({ params }) =>
        Promise.resolve(applyTestOperations(remote, params.payload)),
      )

    await initializeToolboxPreferences({
      store,
      request,
      session: { is_logged_in: true, user: 'person@example.com' },
    })
    store.clearRecentTools()
    store.recordRecent('timer')

    await retryToolboxPreferenceSync()
    await store.flushRemoteSave()

    expect(store.recentToolIds.value).toEqual(['timer'])
    expect(request).toHaveBeenLastCalledWith({
      url: expect.stringMatching(/\.update_preferences$/),
      method: 'POST',
      params: {
        payload: {
          version: 1,
          operations: [{ type: 'clearRecent' }, { type: 'prependRecent', toolId: 'timer' }],
        },
      },
    })
  })

  it('merges two clients that write from the same stale snapshot', async () => {
    let serverPreferences = createDefaultPreferences()
    const createRequest = () =>
      vi.fn(({ method, params }) => {
        if (method === 'GET') return Promise.resolve(structuredClone(serverPreferences))
        serverPreferences = applyTestOperations(serverPreferences, params.payload)
        return Promise.resolve(structuredClone(serverPreferences))
      })
    const firstStore = new ToolboxPreferencesStore()
    const secondStore = new ToolboxPreferencesStore()

    await Promise.all([
      initializeToolboxPreferences({
        store: firstStore,
        request: createRequest(),
        session: { is_logged_in: true, user: 'person@example.com' },
      }),
      initializeToolboxPreferences({
        store: secondStore,
        request: createRequest(),
        session: { is_logged_in: true, user: 'person@example.com' },
      }),
    ])
    firstStore.toggleHidden('calculator')
    secondStore.toggleHidden('timer')

    await firstStore.flushRemoteSave()
    await secondStore.flushRemoteSave()

    expect(serverPreferences.hiddenToolIds).toEqual(['calculator', 'timer'])
  })

  it('preserves hidden order when a tool is removed and re-added before saving', async () => {
    const remote = createDefaultPreferences()
    remote.hiddenToolIds = ['calculator', 'timer']
    const store = new ToolboxPreferencesStore()
    const request = vi
      .fn()
      .mockResolvedValueOnce(remote)
      .mockImplementationOnce(({ params }) =>
        Promise.resolve(applyTestOperations(remote, params.payload)),
      )

    await initializeToolboxPreferences({
      store,
      request,
      session: { is_logged_in: true, user: 'person@example.com' },
    })
    store.toggleHidden('calculator')
    store.toggleHidden('calculator')

    await store.flushRemoteSave()

    expect(store.hiddenIds.value).toEqual(['timer', 'calculator'])
    expect(request).toHaveBeenLastCalledWith({
      url: expect.stringMatching(/\.update_preferences$/),
      method: 'POST',
      params: {
        payload: {
          version: 1,
          operations: [
            { type: 'setHidden', toolId: 'calculator', isHidden: false },
            { type: 'setHidden', toolId: 'calculator', isHidden: true },
          ],
        },
      },
    })
  })

  it.each([
    [{ is_logged_in: true, user: 'person@example.com' }, true],
    [{ is_logged_in: true, user: 'Guest' }, false],
    [{ is_logged_in: false, user: 'person@example.com' }, false],
    [{}, false],
  ])('detects signed-in sessions', (session, expected) => {
    expect(isLoggedInSession(session)).toBe(expected)
  })
})

function applyTestOperations(preferences, payload) {
  const updated = structuredClone(preferences)
  for (const operation of payload.operations) {
    if (operation.type === 'setHidden') {
      updated.hiddenToolIds = operation.isHidden
        ? [...new Set([...updated.hiddenToolIds, operation.toolId])]
        : updated.hiddenToolIds.filter((toolId) => toolId !== operation.toolId)
    } else if (operation.type === 'prependRecent') {
      updated.recentToolIds = [
        operation.toolId,
        ...updated.recentToolIds.filter((toolId) => toolId !== operation.toolId),
      ].slice(0, 10)
    } else if (operation.type === 'clearRecent') {
      updated.recentToolIds = []
    } else if (operation.type === 'setSetting') {
      updated.settings[operation.key] = operation.value
    } else if (operation.type === 'resetSettings') {
      updated.settings = createDefaultPreferences().settings
    }
  }
  return updated
}
