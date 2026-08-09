import { expect, test } from './fixtures'

// A crawler reads the HTTP response and runs no JavaScript, so every check here uses `request`
// rather than `page`. Nothing the client does after boot can rescue an empty head.
//
// This is also the tripwire for the build step that puts the Jinja into toolbox/www/toolbox.html.
// If that injection stops running, every route answers with the same title again, and the unit
// tests still pass, because they test the pieces rather than the served page.

function head(html, pattern) {
  return html.match(pattern)?.[1]
}

test('@smoke gives a crawler a different head for each route', async ({ request }) => {
  const responses = await Promise.all(
    ['/', '/weather', '/gst-calculator'].map(async (path) => {
      const response = await request.get(path)
      expect(response.status(), path).toBe(200)
      return [path, await response.text()]
    }),
  )

  const titles = responses.map(([, html]) => head(html, /<title>([^<]+)<\/title>/))
  expect(new Set(titles).size, `titles were ${JSON.stringify(titles)}`).toBe(3)

  for (const [path, html] of responses) {
    expect(head(html, /<meta name="description" content="([^"]+)"/), path).toBeTruthy()
    expect(head(html, /<link rel="canonical" href="([^"]+)"/), path).toContain(path)
    expect(head(html, /<meta property="og:title" content="([^"]+)"/), path).toBe(
      head(html, /<title>([^<]+)<\/title>/),
    )
    expect(head(html, /<meta property="og:image" content="([^"]+)"/), path).toContain(
      '/assets/toolbox/seo/toolbox-card.png',
    )
  }
})

test('@smoke serves structured data a parser can read', async ({ request }) => {
  const html = await (await request.get('/weather')).text()
  const block = head(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/)

  const documents = JSON.parse(block)
  expect(documents.map((document) => document['@type'])).toEqual([
    'WebApplication',
    'BreadcrumbList',
  ])
  expect(documents[0].name).toBe('Weather')
})

test('keeps the settings page out of the index', async ({ request }) => {
  const html = await (await request.get('/settings')).text()

  expect(head(html, /<meta name="robots" content="([^"]+)"/)).toBe('noindex, follow')
  // Structured data for a page a crawler is asked to skip is only a contradiction.
  expect(html).not.toContain('application/ld+json')
})

test('serves the social card the head points at', async ({ request }) => {
  const response = await request.get('/assets/toolbox/seo/toolbox-card.png')

  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('image/png')
})
