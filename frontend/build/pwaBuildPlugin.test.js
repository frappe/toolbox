import { describe, expect, it } from 'vitest'

import { createReleaseInfo, readAppRoutes, renderServiceWorker, wrapForFrappe } from './pwaBuildPlugin'

const ROUTES = ['/', '/calculator']

describe('Toolbox PWA build plugin', () => {
  it('creates a filesystem-safe release ID', () => {
    const release = createReleaseInfo({
      now: new Date('2026-07-31T12:34:56.789Z'),
      randomSuffix: 'abcdef123456',
    })

    expect(release).toEqual({
      releaseId: '20260731t123456789z-abcdef123456',
      createdAt: 1785501296789,
    })
  })

  it('renders a release-specific service worker', () => {
    const template = `const id = '__TOOLBOX_RELEASE_ID__'\nconst time = __TOOLBOX_RELEASE_CREATED_AT__\nconst routes = __TOOLBOX_APP_ROUTES__\n`
    const first = renderServiceWorker(template, { releaseId: 'release-a', createdAt: 100 }, ROUTES)
    const second = renderServiceWorker(template, { releaseId: 'release-b', createdAt: 200 }, ROUTES)

    expect(first).toContain("const id = 'release-a'")
    expect(second).toContain("const id = 'release-b'")
    expect(first).not.toBe(second)
  })

  it('injects the application routes the worker may claim', () => {
    const template = `const id = '__TOOLBOX_RELEASE_ID__'\nconst time = __TOOLBOX_RELEASE_CREATED_AT__\nconst routes = __TOOLBOX_APP_ROUTES__\n`

    expect(renderServiceWorker(template, { releaseId: 'r', createdAt: 1 }, ROUTES)).toContain(
      'const routes = ["/","/calculator"]',
    )
  })

  it('refuses routes that are not absolute paths, which would never match a pathname', () => {
    const template = `const id = '__TOOLBOX_RELEASE_ID__'\nconst time = __TOOLBOX_RELEASE_CREATED_AT__\nconst routes = __TOOLBOX_APP_ROUTES__\n`

    expect(() =>
      renderServiceWorker(template, { releaseId: 'r', createdAt: 1 }, ['calculator']),
    ).toThrow('must be absolute paths')
    expect(() => renderServiceWorker(template, { releaseId: 'r', createdAt: 1 }, [])).toThrow(
      'at least one application route',
    )
  })

  it('reads the routes from the tool registry, and claims none of Frappe', async () => {
    const routes = await readAppRoutes()

    expect(routes).toContain('/')
    expect(routes).toContain('/calculator')
    for (const reserved of ['/app', '/login', '/api']) expect(routes).not.toContain(reserved)
  })

  it('rejects a template with unresolved release placeholders', () => {
    const template = [
      "const id = '__TOOLBOX_RELEASE_ID__'",
      'const time = __TOOLBOX_RELEASE_CREATED_AT__',
      'const routes = __TOOLBOX_APP_ROUTES__',
      "const duplicate = '__TOOLBOX_RELEASE_ID__'",
    ].join('\n')

    expect(() =>
      renderServiceWorker(template, { releaseId: 'release-a', createdAt: 100 }, ROUTES),
    ).toThrow('Expected one __TOOLBOX_RELEASE_ID__ placeholder')
  })

  it('protects the generated worker from Frappe Jinja rendering', () => {
    const worker = "if (html.includes('{% for key in boot %}')) return"

    expect(wrapForFrappe(worker)).toBe(`{% raw %}\n${worker}\n{% endraw %}\n`)
  })
})
