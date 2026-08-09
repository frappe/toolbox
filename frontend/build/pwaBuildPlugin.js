import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const RELEASE_ID_PLACEHOLDER = '__TOOLBOX_RELEASE_ID__'
const RELEASE_TIME_PLACEHOLDER = '__TOOLBOX_RELEASE_CREATED_AT__'
const APP_ROUTES_PLACEHOLDER = '__TOOLBOX_APP_ROUTES__'
const TEMPLATE_PATH = path.resolve(import.meta.dirname, '../pwa/service-worker.template.js')
const WORKER_OUTPUT_PATH = path.resolve(import.meta.dirname, '../../toolbox/www/toolbox-sw.js')

const SERVER_META_TEMPLATE_PATH = path.resolve(import.meta.dirname, 'server-meta.template.html')
const WEB_PAGE_PATH = path.resolve(import.meta.dirname, '../../toolbox/www/toolbox.html')
export const SERVER_META_START = '<!-- toolbox:server-meta:start -->'
export const SERVER_META_END = '<!-- toolbox:server-meta:end -->'

export function toolboxPwaBuild() {
  let releaseInfo

  return {
    name: 'toolbox-pwa-build',
    apply: 'build',
    buildStart() {
      releaseInfo = createReleaseInfo()
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'release.json',
        source: `${JSON.stringify(releaseInfo, null, 2)}\n`,
      })
    },
    async writeBundle(outputOptions) {
      validateBundleManifest(outputOptions.dir)
      const template = fs.readFileSync(TEMPLATE_PATH, 'utf8')
      const workerSource = wrapForFrappe(
        renderServiceWorker(template, releaseInfo, await readAppRoutes()),
      )
      fs.writeFileSync(WORKER_OUTPUT_PATH, workerSource)
    },
    // closeBundle, not writeBundle: Rollup runs every writeBundle hook in parallel, and the
    // frappe-ui plugin copies the built HTML to toolbox/www/toolbox.html in one of them. Reading
    // that file from a writeBundle hook is a race. closeBundle runs after all of them.
    closeBundle() {
      const metaBlock = fs.readFileSync(SERVER_META_TEMPLATE_PATH, 'utf8')
      const webPage = fs.readFileSync(WEB_PAGE_PATH, 'utf8')
      fs.writeFileSync(WEB_PAGE_PATH, injectServerMeta(webPage, metaBlock))
    },
  }
}

// The metadata is Jinja, so it belongs only in the page Frappe renders. The identical HTML is
// also published as an asset and cached by the service worker as the offline shell, where Jinja
// never runs and `{{ seo.title }}` would be the visitor's tab title.
//
// This throws rather than returning the HTML unchanged. A silent miss ships a site whose every
// page claims the same title, which is the exact failure this whole change exists to fix, and
// nothing else in the build would notice.
export function injectServerMeta(html, metaBlock) {
  const start = html.indexOf(SERVER_META_START)
  const end = html.indexOf(SERVER_META_END)
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `The server metadata markers are missing from the built page. ` +
        `frontend/index.html must keep ${SERVER_META_START} and ${SERVER_META_END}.`,
    )
  }

  return html.slice(0, start) + metaBlock.trimEnd() + html.slice(end + SERVER_META_END.length)
}

export function createReleaseInfo({ now = new Date(), randomSuffix } = {}) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('A valid build date is required')
  }

  const suffix = randomSuffix || randomBytes(6).toString('hex')
  if (!/^[a-f0-9]{12}$/.test(suffix)) {
    throw new TypeError('The release suffix must contain 12 lowercase hexadecimal characters')
  }

  const timestamp = now.toISOString().replace(/[-:.]/g, '').toLowerCase()
  return {
    releaseId: `${timestamp}-${suffix}`,
    createdAt: now.getTime(),
  }
}

// The tool registry is the single source of truth for what the app serves. Reading it here keeps
// the worker's route set exact, which matters at the site root: a prefix test would let the worker
// claim Frappe's own /app and /login pages.
export async function readAppRoutes() {
  const { tools } = await import('../src/data/toolRegistry.js')
  return ['/', '/settings', ...tools.map((tool) => tool.route)]
}

export function renderServiceWorker(template, releaseInfo, appRoutes) {
  validateReleaseInfo(releaseInfo)
  validateAppRoutes(appRoutes)
  const withReleaseId = replacePlaceholder(template, RELEASE_ID_PLACEHOLDER, releaseInfo.releaseId)
  const withRoutes = replacePlaceholder(
    withReleaseId,
    APP_ROUTES_PLACEHOLDER,
    JSON.stringify(appRoutes),
  )
  const workerSource = replacePlaceholder(
    withRoutes,
    RELEASE_TIME_PLACEHOLDER,
    String(releaseInfo.createdAt),
  )

  if (workerSource.includes('__TOOLBOX_RELEASE_')) {
    throw new Error('The service worker contains an unresolved release placeholder')
  }
  return workerSource
}

export function wrapForFrappe(workerSource) {
  return `{% raw %}\n${workerSource.trimEnd()}\n{% endraw %}\n`
}

function replacePlaceholder(source, placeholder, value) {
  const occurrences = source.split(placeholder).length - 1
  if (occurrences !== 1) {
    throw new Error(`Expected one ${placeholder} placeholder, found ${occurrences}`)
  }
  return source.replace(placeholder, value)
}

function validateAppRoutes(appRoutes) {
  if (!Array.isArray(appRoutes) || !appRoutes.length) {
    throw new TypeError('The service worker needs at least one application route')
  }
  const invalid = appRoutes.filter((route) => typeof route !== 'string' || !route.startsWith('/'))
  if (invalid.length) {
    throw new TypeError(`Application routes must be absolute paths: ${invalid.join(', ')}`)
  }
}

function validateReleaseInfo(releaseInfo) {
  if (!releaseInfo || !/^[a-z0-9-]+$/.test(releaseInfo.releaseId)) {
    throw new TypeError('A safe release ID is required')
  }
  if (!Number.isSafeInteger(releaseInfo.createdAt) || releaseInfo.createdAt <= 0) {
    throw new TypeError('A valid release creation time is required')
  }
}

function validateBundleManifest(outputDirectory) {
  if (!outputDirectory) throw new Error('The Vite output directory is required')

  const manifestPath = path.resolve(outputDirectory, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (!manifest['index.html']?.file) {
    throw new Error('The Vite bundle manifest has no application entry')
  }
}
