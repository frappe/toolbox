{% raw %}
const RELEASE_ID = '20260806t054428244z-777ab54568d1'
const RELEASE_CREATED_AT = 1785995068244
const SHELL_CACHE_PREFIX = 'toolbox-shell-'
const SHELL_CACHE = `${SHELL_CACHE_PREFIX}${RELEASE_ID}`
const SHELL_CACHE_METADATA_KEY = '/toolbox-shell-metadata'
const LEGACY_SHELL_CACHE_PATTERN = /^toolbox-shell-v\d+$/
const MAX_RETAINED_SHELL_GENERATIONS = 2
const PROVIDER_CACHE_PREFIX = 'toolbox-provider-'
const OFFLINE_SHELL_SOURCE_URL = '/assets/toolbox/frontend/index.html'
const OFFLINE_SHELL_CACHE_KEY = '/toolbox-offline-shell'
const BUNDLE_MANIFEST_URL = '/assets/toolbox/frontend/manifest.json'
const TOOLBOX_ROUTE_PREFIX = '/toolbox'

const CORE_ASSET_URLS = [
  '/assets/toolbox/pwa/manifest.webmanifest',
  '/assets/toolbox/pwa/toolbox-192.png',
  '/assets/toolbox/pwa/toolbox-512.png',
  '/assets/toolbox/pwa/toolbox-maskable-512.png',
  '/assets/toolbox/toolbox-logo.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(installApplicationShell())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(activateApplicationShell())
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate' && isToolboxRoute(url.pathname)) {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (url.pathname.startsWith('/assets/toolbox/frontend/')) {
    event.respondWith(immutableCacheFirstAsset(request))
    return
  }

  if (CORE_ASSET_URLS.includes(url.pathname)) {
    event.respondWith(immutableCacheFirstAsset(request))
  }
})

async function installApplicationShell() {
  try {
    await populateApplicationShell()
  } catch (error) {
    await caches.delete(SHELL_CACHE)
    throw error
  }

  // The first install has no client generation to protect. Later releases wait
  // for the user so their cache cannot become active mid-session.
  if (!self.registration.active) {
    await self.skipWaiting()
  }
}

async function activateApplicationShell() {
  await pruneShellCacheGenerations()

  // Provider caches use PROVIDER_CACHE_PREFIX and have their own expiry rules.
  // Shell activation never reads, rewrites, or deletes them.
  await self.clients.claim()
}

async function populateApplicationShell() {
  const cache = await caches.open(SHELL_CACHE)
  await Promise.all(CORE_ASSET_URLS.map((url) => fetchAndCacheRequired(cache, url)))

  const bundleUrls = await fetchAndCacheBundle(cache)
  await fetchAndCacheOfflineShell(cache)
  await verifyShellAssets(cache)
  await removeObsoleteBundleAssets(cache, bundleUrls)
  await writeShellCacheMetadata(cache)
}

async function fetchAndCacheRequired(cache, url) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' })
  if (!isCacheable(response)) {
    throw new Error(`A required application-shell asset is unavailable: ${url}`)
  }
  await cache.put(url, response)
}

async function fetchAndCacheOfflineShell(cache) {
  const response = await fetch(OFFLINE_SHELL_SOURCE_URL, {
    cache: 'no-store',
    credentials: 'same-origin',
  })
  if (!isCacheable(response)) {
    throw new Error('The offline application shell is unavailable')
  }

  const headers = new Headers(response.headers)
  headers.delete('content-length')
  headers.set('content-type', 'text/html; charset=utf-8')

  const sourceHtml = await response.text()
  const offlineHtml = removeJinjaBootScript(sourceHtml)
  if (offlineHtml.includes('{% for key in boot %}')) {
    throw new Error('Frappe boot data was not removed from the offline shell')
  }

  const offlineResponse = new Response(offlineHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
  await cache.put(OFFLINE_SHELL_CACHE_KEY, offlineResponse)
}

async function fetchAndCacheBundle(cache) {
  const response = await fetch(BUNDLE_MANIFEST_URL, {
    cache: 'no-store',
    credentials: 'same-origin',
  })
  if (!isCacheable(response)) {
    throw new Error('The application bundle manifest is unavailable')
  }

  const manifest = await response.clone().json()
  const bundleUrls = findBundleAssets(manifest)
  await Promise.allSettled(bundleUrls.map((url) => fetchAndCacheIfMissing(cache, url)))

  const cachedBundle = await Promise.all(bundleUrls.map((url) => cache.match(url)))
  if (cachedBundle.some((cachedResponse) => !cachedResponse)) {
    throw new Error('The application shell bundle is incomplete')
  }

  await cache.put(BUNDLE_MANIFEST_URL, response)
  return bundleUrls
}

async function fetchAndCacheIfMissing(cache, url) {
  if (await cache.match(url)) return
  await fetchAndCacheRequired(cache, url)
}

async function verifyShellAssets(cache) {
  const shellResponse = await cache.match(OFFLINE_SHELL_CACHE_KEY)
  if (!shellResponse) throw new Error('The offline application shell was not cached')

  const shellHtml = await shellResponse.text()
  const assetUrls = findToolboxAssets(shellHtml)
  const cachedAssets = await Promise.all(assetUrls.map((url) => cache.match(url)))
  if (cachedAssets.some((cachedResponse) => !cachedResponse)) {
    throw new Error('The offline application shell references an uncached asset')
  }
}

async function writeShellCacheMetadata(cache) {
  const metadata = JSON.stringify({
    releaseId: RELEASE_ID,
    createdAt: RELEASE_CREATED_AT,
    ready: true,
  })
  await cache.put(
    SHELL_CACHE_METADATA_KEY,
    new Response(metadata, { headers: { 'content-type': 'application/json' } }),
  )
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request)
  } catch {
    const cache = await caches.open(SHELL_CACHE)
    return (await cache.match(OFFLINE_SHELL_CACHE_KEY)) || Response.error()
  }
}

async function immutableCacheFirstAsset(request) {
  const cachedResponse = await matchAcrossShellGenerations(request)
  if (cachedResponse) return cachedResponse

  // Misses belong to a different deployment. Let the network serve them while
  // this immutable generation stays untouched.
  return fetch(request)
}

async function matchAcrossShellGenerations(request) {
  const generations = await getReadyShellCacheGenerations()
  const currentFirst = generations.sort((left, right) => {
    if (left.name === SHELL_CACHE) return -1
    if (right.name === SHELL_CACHE) return 1
    return right.createdAt - left.createdAt
  })

  for (const generation of currentFirst) {
    const response = await caches.match(request, { cacheName: generation.name })
    if (response) return response
  }
  return null
}

async function pruneShellCacheGenerations() {
  const cacheNames = await caches.keys()
  const shellCacheNames = cacheNames.filter((name) => name.startsWith(SHELL_CACHE_PREFIX))
  const readyGenerations = await getReadyShellCacheGenerations(shellCacheNames)
  const previousGenerations = readyGenerations
    .filter((generation) => generation.name !== SHELL_CACHE)
    .sort((left, right) => right.createdAt - left.createdAt)

  const retainedCacheNames = new Set([SHELL_CACHE])
  for (const generation of previousGenerations) {
    if (retainedCacheNames.size >= MAX_RETAINED_SHELL_GENERATIONS) break
    retainedCacheNames.add(generation.name)
  }

  const obsoleteCacheNames = shellCacheNames.filter((name) => !retainedCacheNames.has(name))
  await Promise.all(obsoleteCacheNames.map((name) => caches.delete(name)))
}

async function getReadyShellCacheGenerations(cacheNames) {
  const names =
    cacheNames || (await caches.keys()).filter((name) => name.startsWith(SHELL_CACHE_PREFIX))
  const generations = await Promise.all(names.map((name) => readShellCacheGeneration(name)))
  return generations.filter(Boolean)
}

async function readShellCacheGeneration(name) {
  const metadataResponse = await caches.match(SHELL_CACHE_METADATA_KEY, { cacheName: name })

  if (!metadataResponse) {
    return LEGACY_SHELL_CACHE_PATTERN.test(name) ? { name, createdAt: 0 } : null
  }

  try {
    const metadata = await metadataResponse.json()
    if (metadata.ready !== true || !Number.isFinite(metadata.createdAt)) return null
    return { name, createdAt: metadata.createdAt }
  } catch {
    return null
  }
}

function findToolboxAssets(html) {
  const assetUrls = new Set()
  const attributePattern = /\b(?:href|src)=["']([^"'#]+)["']/gi

  for (const match of html.matchAll(attributePattern)) {
    const url = new URL(match[1], self.location.origin)
    if (url.origin === self.location.origin && url.pathname.startsWith('/assets/toolbox/')) {
      assetUrls.add(`${url.pathname}${url.search}`)
    }
  }
  return [...assetUrls]
}

function findBundleAssets(manifest) {
  const bundleUrls = new Set()
  const bundleBaseUrl = new URL(OFFLINE_SHELL_SOURCE_URL, self.location.origin)

  for (const entry of Object.values(manifest)) {
    for (const assetPath of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) {
      if (!assetPath) continue
      const assetUrl = new URL(assetPath, bundleBaseUrl)
      if (
        assetUrl.origin === self.location.origin &&
        assetUrl.pathname.startsWith('/assets/toolbox/frontend/')
      ) {
        bundleUrls.add(`${assetUrl.pathname}${assetUrl.search}`)
      }
    }
  }
  return [...bundleUrls]
}

async function removeObsoleteBundleAssets(cache, bundleUrls) {
  const currentBundleUrls = new Set([BUNDLE_MANIFEST_URL, ...bundleUrls])
  const requests = await cache.keys()

  const obsoleteRequests = requests.filter((request) => {
    const url = new URL(request.url)
    return (
      url.pathname.startsWith('/assets/toolbox/frontend/') &&
      !currentBundleUrls.has(`${url.pathname}${url.search}`)
    )
  })
  await Promise.all(obsoleteRequests.map((request) => cache.delete(request)))
}

function removeJinjaBootScript(html) {
  return html.replace(/<script>\s*{% for key in boot %}[\s\S]*?{% endfor %}\s*<\/script>/i, '')
}

function isToolboxRoute(pathname) {
  return pathname === TOOLBOX_ROUTE_PREFIX || pathname.startsWith(`${TOOLBOX_ROUTE_PREFIX}/`)
}

function isCacheable(response) {
  return response.ok && (response.type === 'basic' || response.type === 'default')
}

// Kept visible for future provider adapters. Their cache names must start with
// this value and must never share the application-shell cache.
void PROVIDER_CACHE_PREFIX
{% endraw %}
