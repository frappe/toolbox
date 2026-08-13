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
  // A written page adds FAQPage and HowTo after these two.
  expect(documents.map((document) => document['@type']).slice(0, 2)).toEqual([
    'WebApplication',
    'BreadcrumbList',
  ])
  expect(documents[0].name).toBe('Weather')
})

test('@smoke gives a crawler the heading and the content of the page', async ({ request }) => {
  const html = await (await request.get('/emi-calculator')).text()
  const body = html.slice(html.indexOf('<div id="app"'))

  expect(body).toContain('<h1')
  expect(body).toContain('EMI Calculator')
  expect(body).toContain('Frequently asked questions')
  expect(body).toContain('Why is an early instalment almost all interest?')

  const documents = JSON.parse(head(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/))
  const types = documents.map((document) => document['@type'])
  expect(types).toContain('FAQPage')
  expect(types).toContain('HowTo')
})

test('@smoke gives a crawler the front door, with a link to every tool', async ({ request }) => {
  // The root carried a title and an empty body until the heading moved to seo.py. A crawler that
  // runs no JavaScript reached a tool only through the sitemap, which carries a URL and no words.
  const html = await (await request.get('/')).text()
  const body = html.slice(html.indexOf('<div id="app"'), html.indexOf('<script', html.indexOf('<div id="app"')))

  expect(body).toContain('<h1')
  expect(body).toContain('All Tools')
  for (const path of ['/calculator', '/emi-calculator', '/weather', '/audio-editor']) {
    expect(body, `${path} is not linked from the root`).toContain(`href="${path}"`)
  }
})

test('gives a crawler a heading on a page that is not a tool', async ({ request }) => {
  const html = await (await request.get('/data-sources')).text()
  const body = html.slice(html.indexOf('<div id="app"'), html.indexOf('<script', html.indexOf('<div id="app"')))

  expect(body).toContain('<h1')
  expect(body).toContain('Data Sources')
})

test('gives a crawler a heading even where the content is not written yet', async ({ request }) => {
  const html = await (await request.get('/pace-calculator')).text()
  const body = html.slice(html.indexOf('<div id="app"'))

  expect(body).toContain('Pace Calculator')
  expect(body).toContain('<noscript>')
})

test('@smoke shows the content once, under the tool', async ({ page }) => {
  // The server block sits inside the element the application mounts on, so Vue replaces it. A
  // block anywhere else would still be there after boot, and the page would say everything twice.
  await page.goto('/emi-calculator')
  await expect(page.getByRole('heading', { level: 1, name: 'EMI Calculator' })).toBeVisible()

  await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.getByText('Why is an early instalment almost all interest?')).toBeVisible()
})

test('replaces the content when the visitor moves to another tool', async ({ page }) => {
  await page.goto('/emi-calculator')
  await expect(page.getByText('equated monthly instalment')).toBeVisible()

  // "Calculator" is also the start of several other tool names, so the lookup is exact.
  await page
    .getByRole('navigation', { name: 'Toolbox navigation' })
    .getByRole('link', { name: 'Calculator', exact: true })
    .click()

  await expect(page.getByText('The calculator reads a whole expression')).toBeVisible()
  await expect(page.getByText('equated monthly instalment')).toHaveCount(0)
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

// Both of these override a file Frappe already serves, and the override only holds because
// TemplatePage searches installed apps in reverse order. If that ever changes, Frappe answers
// again: an empty robots.txt, and a sitemap offering its own /about and /contact.
test('@smoke offers every tool in the sitemap', async ({ request }) => {
  const response = await request.get('/sitemap.xml')
  expect(response.headers()['content-type']).toContain('xml')

  const locations = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, location]) => new URL(location).pathname,
  )

  expect(locations).toContain('/')
  for (const path of ['/weather', '/calculator', '/dictionary', '/audio-editor']) {
    expect(locations, `${path} is missing from the sitemap`).toContain(path)
  }
  // Advertising a page that carries noindex is a contradiction.
  expect(locations).not.toContain('/settings')
  // `/about` is Toolbox's own page now, not Frappe's stock one, and it belongs here.
  expect(locations).toContain('/about')
  expect(locations).not.toContain('/contact')
})

test('@smoke serves robots.txt from the app, not from an empty site field', async ({ request }) => {
  const response = await request.get('/robots.txt')
  expect(response.headers()['content-type']).toContain('text/plain')

  const body = await response.text()
  expect(body).toMatch(/^Sitemap: https?:\/\/.+\/sitemap\.xml$/m)
  expect(body).toContain('Disallow: /api/')
  // A blanket allow would silently void every Disallow under a first-match parser.
  expect(body).not.toMatch(/^Allow:/m)
})

test('serves the data sources page, and offers it in the sitemap', async ({ page, request }) => {
  const locations = [...(await (await request.get('/sitemap.xml')).text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, location]) => new URL(location).pathname,
  )
  expect(locations).toContain('/data-sources')

  // A hard refresh has to reach the app, which needs the route in toolbox/routes.py.
  await page.goto('/data-sources')
  await expect(page.getByRole('heading', { level: 1, name: 'Where the data comes from' })).toBeVisible()
  // The page names WordNet four times over, so the assertion picks the release fact rather than
  // any mention of it.
  await expect(page.getByText('WordNet-3.1')).toBeVisible()
  await expect(page.getByText('165,616')).toBeVisible()
})

test('@smoke serves the About page instead of Frappe\'s stock one', async ({ request }) => {
  // Frappe ships its own /about, which redirects to /404 when no About Us Settings doc exists.
  // The route rule in toolbox/routes.py takes the path before a renderer is chosen, so this wins.
  const response = await request.get('/about')
  expect(response.status()).toBe(200)

  const html = await response.text()
  const body = html.slice(html.indexOf('<div id="app"'), html.indexOf('<script', html.indexOf('<div id="app"')))

  expect(body).toContain('About Toolbox')
  expect(body).toContain('href="https://frappe.io"')
  expect(body).toContain('href="https://frappe.io/erpnext"')
  // A link out of the site opens in its own tab and carries no referrer.
  expect(body).toContain('rel="noreferrer"')
})
