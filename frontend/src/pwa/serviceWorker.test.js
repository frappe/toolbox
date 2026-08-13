import { beforeEach, describe, expect, it } from 'vitest'

import {
  assetUrl,
  createAssetRequest,
  createWorkerHarness,
  deployGeneration,
} from './serviceWorkerTestHarness'

const OFFLINE_SHELL_KEY = '/toolbox-offline-shell'
const SHELL_METADATA_KEY = '/toolbox-shell-metadata'

describe('Toolbox service worker', () => {
  let harness

  beforeEach(() => {
    harness = createWorkerHarness()
    deployGeneration(harness.server, 'a')
  })

  it('creates a complete generation without Frappe boot data', async () => {
    await harness.dispatchExtendable('install')

    const cachedHtml = await (await harness.match(OFFLINE_SHELL_KEY)).text()
    const metadata = await (await harness.match(SHELL_METADATA_KEY)).json()
    expect(cachedHtml).not.toContain('{% for key in boot %}')
    expect(cachedHtml).not.toContain('window["{{ key }}"]')
    expect(await harness.match(assetUrl('index', 'a'))).toBeTruthy()
    expect(await harness.match(assetUrl('ToolView', 'a'))).toBeTruthy()
    expect(metadata).toEqual({ releaseId: 'release-a', createdAt: 100, ready: true })
    expect(harness.self.skipWaiting).toHaveBeenCalledOnce()
  })

  it('serves the current cached shell for offline app navigation', async () => {
    await harness.dispatchExtendable('install')
    harness.server.failRequests = true

    const response = await harness.dispatchFetch({
      method: 'GET',
      mode: 'navigate',
      url: 'https://toolbox.localhost/calculator',
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<div id="app"></div>')
  })

  // At the site root the worker sees every navigation on the origin, including Frappe's own
  // pages. Handing /app or /login the Toolbox shell would break the desk and the login form,
  // online as well as offline. The worker matches an exact route set for this reason.
  it('ignores navigation to a path the app does not own', async () => {
    await harness.dispatchExtendable('install')
    harness.server.failRequests = true

    for (const path of ['/app', '/login', '/some-other-page']) {
      const response = await harness.dispatchFetch({
        method: 'GET',
        mode: 'navigate',
        url: `https://toolbox.localhost${path}`,
      })
      expect(response, path).toBeUndefined()
    }
  })

  it('keeps an older lazy chunk available after the next generation activates', async () => {
    await harness.dispatchExtendable('install')
    const oldChunkUrl = assetUrl('ToolView', 'a')

    deployGeneration(harness.server, 'b')
    const newChunkUrl = assetUrl('ToolView', 'b')
    const networkResponse = await harness.dispatchFetch(createAssetRequest(newChunkUrl))
    expect(await networkResponse.text()).toBe('ToolView b')
    expect(await harness.match(newChunkUrl)).toBeUndefined()

    const nextHarness = createWorkerHarness({
      releaseId: 'release-b',
      createdAt: 200,
      caches: harness.caches,
      server: harness.server,
      hasActiveWorker: true,
    })
    await nextHarness.dispatchExtendable('install')
    await nextHarness.dispatchExtendable('activate')

    harness.server.failPaths.add(oldChunkUrl)
    const oldClientResponse = await nextHarness.dispatchFetch(createAssetRequest(oldChunkUrl))
    expect(await oldClientResponse.text()).toBe('ToolView a')
    expect(await harness.caches.keys()).toEqual(
      expect.arrayContaining(['toolbox-shell-release-a', 'toolbox-shell-release-b']),
    )
  })

  it('deletes an interrupted generation and keeps the last complete shell', async () => {
    await harness.dispatchExtendable('install')
    deployGeneration(harness.server, 'b')
    harness.server.failPaths.add(assetUrl('ToolView', 'b'))

    const interruptedHarness = createWorkerHarness({
      releaseId: 'release-b',
      createdAt: 200,
      caches: harness.caches,
      server: harness.server,
      hasActiveWorker: true,
    })

    await expect(interruptedHarness.dispatchExtendable('install')).rejects.toThrow(
      'application shell bundle is incomplete',
    )
    expect(await harness.caches.keys()).not.toContain('toolbox-shell-release-b')
    expect(await harness.match(assetUrl('ToolView', 'a'))).toBeTruthy()
    expect(await (await harness.match(OFFLINE_SHELL_KEY)).text()).toContain('index-a.js')
  })

  it('retains only the current and immediately previous complete generations', async () => {
    await harness.dispatchExtendable('install')

    const secondHarness = await installAndActivateNextGeneration(harness, 'b', 200)
    const thirdHarness = await installAndActivateNextGeneration(secondHarness, 'c', 300)
    const shellCaches = (await thirdHarness.caches.keys()).filter((name) =>
      name.startsWith('toolbox-shell-'),
    )

    expect(shellCaches).toEqual(['toolbox-shell-release-b', 'toolbox-shell-release-c'])
  })

  it('keeps provider caches and one legacy shell during the generated-cache migration', async () => {
    await harness.dispatchExtendable('install')
    await harness.caches.open('toolbox-shell-v2')
    await harness.caches.open('toolbox-provider-currency-v1')

    await harness.dispatchExtendable('activate')

    expect(await harness.caches.keys()).toEqual([
      'toolbox-shell-release-a',
      'toolbox-shell-v2',
      'toolbox-provider-currency-v1',
    ])
  })

  it('leaves updates waiting until the client requests activation', async () => {
    harness.self.registration.active = { state: 'activated' }

    await harness.dispatchExtendable('install')
    expect(harness.self.skipWaiting).not.toHaveBeenCalled()

    harness.dispatchMessage({ type: 'SKIP_WAITING' })
    expect(harness.self.skipWaiting).toHaveBeenCalledOnce()
  })
})

async function installAndActivateNextGeneration(previousHarness, generation, createdAt) {
  deployGeneration(previousHarness.server, generation)
  const nextHarness = createWorkerHarness({
    releaseId: `release-${generation}`,
    createdAt,
    caches: previousHarness.caches,
    server: previousHarness.server,
    hasActiveWorker: true,
  })
  await nextHarness.dispatchExtendable('install')
  await nextHarness.dispatchExtendable('activate')
  return nextHarness
}
