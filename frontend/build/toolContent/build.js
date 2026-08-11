// Turn the Markdown content files into the one artifact both sides read.
//
// The build writes a JSON file for each tool route. The server reads it to render the page for a
// crawler, and the client imports it as a lazy chunk to show the same words after an in-app
// navigation. The files are committed, so a fresh clone, the Python tests and a deployment all read
// real content without running this first.

import fs from 'node:fs'
import path from 'node:path'

import { ContentError, parseToolContent } from './parse.js'
import { renderContent } from './render.js'

const APP_ROOT = path.resolve(import.meta.dirname, '../../..')
const CONTENT_DIRECTORY = path.join(APP_ROOT, 'toolbox', 'content')
export const PAGES_DIRECTORY = path.join(CONTENT_DIRECTORY, 'pages')

export async function buildToolContent() {
  const { tools } = await import('../../src/data/toolRegistry.js')
  const routes = tools.map((tool) => tool.route)
  const written = []

  checkForOrphans(readContentFiles(), routes)
  fs.mkdirSync(PAGES_DIRECTORY, { recursive: true })

  for (const tool of tools) {
    const page = buildPage(tool, routes)
    const filePath = path.join(PAGES_DIRECTORY, `${slugOf(tool.route)}.json`)
    writeIfChanged(filePath, `${JSON.stringify(page, null, 2)}\n`)
    written.push(page)
  }

  removeStalePages(routes)
  return written
}

export function buildPage(tool, knownRoutes = []) {
  const source = path.join(CONTENT_DIRECTORY, `${slugOf(tool.route)}.md`)
  const page = { route: tool.route, content: '', faqs: [], steps: [] }
  if (!fs.existsSync(source)) return page

  const markdown = fs.readFileSync(source, 'utf8')
  const { sections, faqs, steps } = parseToolContent(markdown, {
    source: path.relative(APP_ROOT, source),
    knownRoutes,
  })
  return { ...page, content: renderContent(sections), faqs, steps }
}

// A content file whose name matches no route is content nobody can read. It is almost always a
// route that was renamed, and the page it belonged to now serves nothing.
function checkForOrphans(files, routes) {
  const slugs = routes.map(slugOf)
  const orphans = files.filter((file) => !slugs.includes(file.replace(/\.md$/, '')))
  if (orphans.length) {
    throw new ContentError(
      `No route serves ${orphans.join(', ')} in toolbox/content. Rename the file to match its route`,
    )
  }
}

// README.md documents the format for the person writing a page, so it names no route.
function readContentFiles() {
  if (!fs.existsSync(CONTENT_DIRECTORY)) return []
  return fs.readdirSync(CONTENT_DIRECTORY).filter((file) => file.endsWith('.md') && file !== 'README.md')
}

// A page file left behind by a removed tool would keep serving a route that no longer exists.
function removeStalePages(routes) {
  const expected = routes.map((route) => `${slugOf(route)}.json`)
  for (const file of fs.readdirSync(PAGES_DIRECTORY)) {
    if (file.endsWith('.json') && !expected.includes(file)) {
      fs.rmSync(path.join(PAGES_DIRECTORY, file))
    }
  }
}

// Rewriting an unchanged file makes every build look like a content change to git, and restarts
// anything watching the directory.
function writeIfChanged(filePath, contents) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === contents) return false
  fs.writeFileSync(filePath, contents)
  return true
}

export function slugOf(route) {
  return route.replace(/^\//, '')
}
