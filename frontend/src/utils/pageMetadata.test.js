import { afterEach, describe, expect, it, vi } from 'vitest'

import { tools } from '@/data/toolRegistry'
import { applyPageMetadata, resolveCanonical, resolveTitle, syncPageMetadata } from './pageMetadata'

afterEach(() => {
  delete globalThis.toolbox_page_titles
})

describe('resolveTitle', () => {
  it('repeats the title the server rendered', () => {
    globalThis.toolbox_page_titles = { '/weather': 'Weather Forecast by City — Ten Day Outlook' }

    expect(resolveTitle('/weather')).toBe('Weather Forecast by City — Ten Day Outlook')
  })

  it('falls back to the registry when the offline shell brought no boot payload', () => {
    const weather = tools.find((tool) => tool.route === '/weather')

    expect(resolveTitle('/weather')).toBe(`${weather.name} | Toolbox`)
  })

  it('names the site for a route that is not a tool', () => {
    expect(resolveTitle('/')).toBe('Toolbox')
  })
})

describe('resolveCanonical', () => {
  it('makes an absolute URL from the origin the visitor is on', () => {
    expect(resolveCanonical('/timer', 'https://frappe.tools')).toBe('https://frappe.tools/timer')
  })

  it('returns the path when there is no origin to join it to', () => {
    expect(resolveCanonical('/timer', undefined)).toBe('/timer')
    expect(resolveCanonical('/timer', '')).toBe('/timer')
  })
})

describe('applyPageMetadata', () => {
  it('sets the title and moves the canonical link to the new route', () => {
    globalThis.toolbox_page_titles = { '/timer': 'Online Timer — Count Down From Any Number of Minutes' }
    document.head.innerHTML = '<link rel="canonical" href="https://frappe.tools/" />'

    applyPageMetadata('/timer')

    expect(document.title).toBe('Online Timer — Count Down From Any Number of Minutes')
    // A canonical still naming the entry route tells a crawler every page is really that one.
    expect(document.querySelector('link[rel="canonical"]').getAttribute('href')).toBe(
      `${globalThis.location.origin}/timer`,
    )
  })

  it('sets the title on a page that has no canonical link', () => {
    document.head.innerHTML = ''

    expect(() => applyPageMetadata('/timer')).not.toThrow()
    expect(document.title).toBe('Timer | Toolbox')
  })
})

describe('syncPageMetadata', () => {
  it('updates the head after every in-app navigation', () => {
    globalThis.toolbox_page_titles = { '/dictionary': 'English Dictionary' }
    let afterEachHandler
    const router = { afterEach: vi.fn((handler) => (afterEachHandler = handler)) }

    syncPageMetadata(router)
    afterEachHandler({ path: '/dictionary' })

    expect(document.title).toBe('English Dictionary')
  })
})
