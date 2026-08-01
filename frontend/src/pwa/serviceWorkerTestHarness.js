import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

import { vi } from 'vitest'

import { renderServiceWorker } from '../../build/pwaBuildPlugin'

const WORKER_TEMPLATE_PATH = path.resolve(
  import.meta.dirname,
  '../../pwa/service-worker.template.js',
)

export function createWorkerHarness({
  releaseId = 'release-a',
  createdAt = 100,
  caches = new MemoryCacheStorage(),
  server = createServer(),
  hasActiveWorker = false,
} = {}) {
  const listeners = new Map()
  const cacheName = `toolbox-shell-${releaseId}`
  const self = createWorkerGlobal(listeners, hasActiveWorker)
  const harness = createHarness({ cacheName, caches, listeners, self, server })
  const fetch = createFetch(server)

  const template = fs.readFileSync(WORKER_TEMPLATE_PATH, 'utf8')
  const workerSource = renderServiceWorker(template, { releaseId, createdAt })
  vm.runInNewContext(workerSource, {
    Headers,
    Promise,
    Request,
    Response,
    Set,
    URL,
    caches,
    fetch,
    self,
  })
  return harness
}

export function deployGeneration(server, generation) {
  server.failPaths.clear()
  server.failRequests = false
  server.responses.set(
    '/assets/toolbox/frontend/index.html',
    new Response(createShellHtml(generation), { headers: { 'content-type': 'text/html' } }),
  )
  server.responses.set(
    '/assets/toolbox/frontend/manifest.json',
    new Response(createBundleManifest(generation), {
      headers: { 'content-type': 'application/json' },
    }),
  )
  server.responses.set(assetUrl('index', generation), new Response(`index ${generation}`))
  server.responses.set(assetUrl('ToolView', generation), new Response(`ToolView ${generation}`))
}

export function createAssetRequest(url) {
  return { method: 'GET', mode: 'cors', url: `https://toolbox.localhost${url}` }
}

export function assetUrl(name, generation) {
  return `/assets/toolbox/frontend/assets/${name}-${generation}.js`
}

function createWorkerGlobal(listeners, hasActiveWorker) {
  return {
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
    location: { origin: 'https://toolbox.localhost' },
    registration: { active: hasActiveWorker ? { state: 'activated' } : null },
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    addEventListener: (type, listener) => listeners.set(type, listener),
  }
}

function createHarness({ cacheName, caches, listeners, self, server }) {
  return {
    cacheName,
    caches,
    server,
    self,
    async match(key, targetCacheName = cacheName) {
      const cache = await caches.open(targetCacheName)
      return cache.match(key)
    },
    async dispatchExtendable(type) {
      const pending = []
      listeners.get(type)({ waitUntil: (promise) => pending.push(promise) })
      await Promise.all(pending)
    },
    async dispatchFetch(request) {
      let responsePromise
      listeners.get('fetch')({
        request,
        respondWith: (promise) => {
          responsePromise = promise
        },
      })
      return responsePromise
    },
    dispatchMessage(data) {
      listeners.get('message')({ data })
    },
  }
}

function createFetch(server) {
  return vi.fn(async (request) => {
    if (server.failRequests) throw new TypeError('offline')

    const requestPath = getPath(request)
    if (server.failPaths.has(requestPath)) throw new TypeError('request failed')
    return server.responses.get(requestPath)?.clone() || new Response('asset', { status: 200 })
  })
}

function createServer() {
  return {
    failPaths: new Set(),
    failRequests: false,
    responses: new Map(),
  }
}

class MemoryCacheStorage {
  constructor() {
    this.cacheByName = new Map()
  }

  async open(name) {
    if (!this.cacheByName.has(name)) this.cacheByName.set(name, new MemoryCache())
    return this.cacheByName.get(name)
  }

  async keys() {
    return [...this.cacheByName.keys()]
  }

  async match(request, { cacheName } = {}) {
    if (cacheName) return this.cacheByName.get(cacheName)?.match(request)

    for (const cache of this.cacheByName.values()) {
      const response = await cache.match(request)
      if (response) return response
    }
    return undefined
  }

  async delete(name) {
    return this.cacheByName.delete(name)
  }
}

class MemoryCache {
  constructor() {
    this.responseByUrl = new Map()
  }

  async put(request, response) {
    this.responseByUrl.set(getCacheKey(request), response.clone())
  }

  async match(request) {
    return this.responseByUrl.get(getCacheKey(request))?.clone()
  }

  async keys() {
    return [...this.responseByUrl.keys()].map((url) => ({
      url: new URL(url, 'https://toolbox.localhost').href,
    }))
  }

  async delete(request) {
    return this.responseByUrl.delete(getCacheKey(request))
  }
}

function getCacheKey(request) {
  const value = typeof request === 'string' ? request : request.url
  const url = new URL(value, 'https://toolbox.localhost')
  return `${url.pathname}${url.search}`
}

function getPath(request) {
  const value = typeof request === 'string' ? request : request.url
  return new URL(value, 'https://toolbox.localhost').pathname
}

function createShellHtml(generation) {
  return `<!doctype html>
    <html>
      <head><script type="module" src="${assetUrl('index', generation)}"></script></head>
      <body>
        <div id="app"></div>
        <script>
          {% for key in boot %}
          window["{{ key }}"] = {{ boot[key] | tojson }};
          {% endfor %}
        </script>
      </body>
    </html>`
}

function createBundleManifest(generation) {
  return JSON.stringify({
    'index.html': { file: `assets/index-${generation}.js`, isEntry: true },
    'src/views/ToolView.vue': {
      file: `assets/ToolView-${generation}.js`,
      isDynamicEntry: true,
    },
  })
}
