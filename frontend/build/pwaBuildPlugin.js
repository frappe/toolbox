import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { appRoutes } from './appRoutes.js'
import { buildToolContent } from './toolContent/build.js'

const RELEASE_ID_PLACEHOLDER = '__TOOLBOX_RELEASE_ID__'
const RELEASE_TIME_PLACEHOLDER = '__TOOLBOX_RELEASE_CREATED_AT__'
const APP_ROUTES_PLACEHOLDER = '__TOOLBOX_APP_ROUTES__'
const TEMPLATE_PATH = path.resolve(import.meta.dirname, '../pwa/service-worker.template.js')
const WORKER_OUTPUT_PATH = path.resolve(import.meta.dirname, '../../toolbox/www/toolbox-sw.js')

const WEB_PAGE_PATH = path.resolve(import.meta.dirname, '../../toolbox/www/toolbox.html')

// Two blocks of Jinja, each replacing a marked region of the built page. The head block carries the
// metadata a search engine reads. The body block carries the heading and the content a crawler
// reads, inside the element the application mounts on.
export const SERVER_META_MARKERS = {
  start: '<!-- toolbox:server-meta:start -->',
  end: '<!-- toolbox:server-meta:end -->',
  templatePath: path.resolve(import.meta.dirname, 'server-meta.template.html'),
}
export const SERVER_CONTENT_MARKERS = {
  start: '<!-- toolbox:server-content:start -->',
  end: '<!-- toolbox:server-content:end -->',
  templatePath: path.resolve(import.meta.dirname, 'server-content.template.html'),
}

export function toolboxPwaBuild() {
  let releaseInfo

  return {
    name: 'toolbox-pwa-build',
    apply: 'build',
    async buildStart() {
      releaseInfo = createReleaseInfo()
      // Before the client bundles anything: the page files are what its content chunks import.
      await buildToolContent()
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
      // Both blocks are written in one pass. Rollup treats closeBundle as a parallel hook too, so
      // two plugins reading and writing this file would race each other.
      let page = fs.readFileSync(WEB_PAGE_PATH, 'utf8')
      for (const markers of [SERVER_META_MARKERS, SERVER_CONTENT_MARKERS]) {
        page = injectBlock(page, markers, fs.readFileSync(markers.templatePath, 'utf8'))
      }
      fs.writeFileSync(WEB_PAGE_PATH, page)
    },
  }
}

// Each block is Jinja, so it belongs only in the page Frappe renders. The identical HTML is also
// published as an asset and cached by the service worker as the offline shell, where Jinja never
// runs and `{{ seo.title }}` would be the visitor's tab title.
//
// This throws rather than returning the HTML unchanged. A silent miss ships a site whose every
// page claims the same title and carries no content, which is the exact failure these blocks exist
// to fix, and nothing else in the build would notice.
export function injectBlock(html, markers, block) {
  const start = html.indexOf(markers.start)
  const end = html.indexOf(markers.end)
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `The ${markers.start} markers are missing from the built page. ` +
        `frontend/index.html must keep ${markers.start} and ${markers.end}.`,
    )
  }

  return html.slice(0, start) + block.trimEnd() + html.slice(end + markers.end.length)
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
  return appRoutes()
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
