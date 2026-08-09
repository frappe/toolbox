import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { readAppRoutes } from '../../build/pwaBuildPlugin.js'
import { tools } from './toolRegistry'

// Three places have to agree on what the app serves, and none of them imports the others:
//
//   1. `toolRegistry.js` — the source of truth.
//   2. `toolbox/routes.py` — the Frappe route rules. These are an explicit list rather than a
//      catch-all, because a catch-all at the site root would swallow /login, /app and every other
//      website page.
//   3. The service worker's route set, injected at build time.
//
// A tool added to the registry without a rule in routes.py 404s on a hard refresh, while the SPA
// still navigates to it fine from inside the app. That failure is invisible to every other test.
const routesPy = readFileSync(
  path.resolve(import.meta.dirname, '../../../toolbox/routes.py'),
  'utf8',
)

function pythonTuple(name) {
  const block = routesPy.match(new RegExp(`${name} = \\(([\\s\\S]*?)\\)`))
  if (!block) throw new Error(`${name} not found in toolbox/routes.py`)
  return [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1])
}

describe('app routes agree across the registry, Frappe, and the service worker', () => {
  it('routes.py lists exactly the registry tools', () => {
    expect(pythonTuple('TOOL_ROUTES').sort()).toEqual(
      tools.map((tool) => tool.route.slice(1)).sort(),
    )
  })

  it('routes.py does not route all-tools, because the root is that page', () => {
    expect(pythonTuple('APP_PAGES')).toEqual(['settings'])
  })

  it('the service worker claims every app route and nothing of Frappe', async () => {
    const swRoutes = await readAppRoutes()

    expect(swRoutes).toContain('/')
    expect(swRoutes).toContain('/settings')
    for (const tool of tools) expect(swRoutes).toContain(tool.route)

    // Claiming these would hand Frappe's own pages the Toolbox shell.
    for (const reserved of ['/app', '/login', '/api', '/assets', '/files']) {
      expect(swRoutes).not.toContain(reserved)
    }
  })
})
