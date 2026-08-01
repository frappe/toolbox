import { describe, expect, it, vi } from 'vitest'

import {
  SERVICE_WORKER_SCOPE,
  SERVICE_WORKER_URL,
  ToolboxServiceWorkerManager,
} from './serviceWorkerRegistration'

function createWorker(state = 'installing') {
  const worker = new EventTarget()
  worker.state = state
  worker.postMessage = vi.fn()
  return worker
}

function createServiceWorkerEnvironment({ controller = {}, waiting = null } = {}) {
  const serviceWorker = new EventTarget()
  serviceWorker.controller = controller

  const registration = new EventTarget()
  registration.installing = null
  registration.waiting = waiting
  registration.update = vi.fn().mockResolvedValue(undefined)
  serviceWorker.register = vi.fn().mockResolvedValue(registration)

  const browserWindow = { location: { reload: vi.fn() } }
  const browserNavigator = { serviceWorker }
  return { browserNavigator, browserWindow, registration, serviceWorker }
}

describe('ToolboxServiceWorkerManager', () => {
  it('does nothing when service workers are unavailable', async () => {
    const manager = new ToolboxServiceWorkerManager({
      browserNavigator: {},
      browserWindow: { location: { reload: vi.fn() } },
    })

    await expect(manager.register()).resolves.toBeNull()
  })

  it('registers the worker with a Toolbox-only scope', async () => {
    const environment = createServiceWorkerEnvironment({ controller: null })
    const manager = new ToolboxServiceWorkerManager(environment)

    await manager.register()

    expect(environment.serviceWorker.register).toHaveBeenCalledWith(SERVICE_WORKER_URL, {
      scope: SERVICE_WORKER_SCOPE,
      updateViaCache: 'none',
    })
    expect(environment.registration.update).toHaveBeenCalledOnce()
  })

  it('reports a worker that is already waiting', async () => {
    const waiting = createWorker('installed')
    const environment = createServiceWorkerEnvironment({ waiting })
    const onUpdateReady = vi.fn()
    const manager = new ToolboxServiceWorkerManager({
      ...environment,
      callbacks: { onUpdateReady },
    })

    await manager.register()

    expect(onUpdateReady).toHaveBeenCalledOnce()
  })

  it('reports an update after the new worker finishes installing', async () => {
    const environment = createServiceWorkerEnvironment()
    const installing = createWorker()
    const onUpdateReady = vi.fn()
    const manager = new ToolboxServiceWorkerManager({
      ...environment,
      callbacks: { onUpdateReady },
    })
    await manager.register()

    environment.registration.installing = installing
    environment.registration.dispatchEvent(new Event('updatefound'))
    installing.state = 'installed'
    installing.dispatchEvent(new Event('statechange'))

    expect(onUpdateReady).toHaveBeenCalledOnce()
  })

  it('activates a waiting update only after user action', async () => {
    const waiting = createWorker('installed')
    const environment = createServiceWorkerEnvironment({ waiting })
    const manager = new ToolboxServiceWorkerManager(environment)
    await manager.register()

    expect(manager.applyWaitingUpdate()).toBe(true)
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(environment.browserWindow.location.reload).not.toHaveBeenCalled()

    environment.serviceWorker.dispatchEvent(new Event('controllerchange'))
    environment.serviceWorker.dispatchEvent(new Event('controllerchange'))
    expect(environment.browserWindow.location.reload).toHaveBeenCalledOnce()
  })

  it('contains registration errors and reports them to the UI', async () => {
    const environment = createServiceWorkerEnvironment()
    const error = new Error('registration failed')
    environment.serviceWorker.register.mockRejectedValue(error)
    const onRegistrationError = vi.fn()
    const manager = new ToolboxServiceWorkerManager({
      ...environment,
      callbacks: { onRegistrationError },
    })

    await expect(manager.register()).resolves.toBeNull()
    expect(onRegistrationError).toHaveBeenCalledWith(error)
  })
})
