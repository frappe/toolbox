import { createRequire } from 'node:module'
import { join } from 'node:path'

import { readJson, run } from '../process.mjs'

export const id = 'lighthouse'
export const name = 'Lighthouse'
export const tier = 'full'
export const readOnly = true

// Five routes, chosen to cover the shapes rather than the count: the index, a pure client tool, a
// tool that calls the server, a tool with a heavy result table, and a tool with a large dataset
// behind it. Scoring all 37 would add ten minutes and repeat the same shell.
const ROUTES = ['/', '/calculator', '/currency-converter', '/emi-calculator', '/dictionary']

export async function execute({ appRoot, qaRoot, reportDir, baseUrl }) {
  const budgets = (await readJson(join(qaRoot, 'fixtures/budgets.json')))?.lighthouse
  if (!budgets) return { status: 'failed', failures: [{ name: 'no budgets', detail: 'fixtures/budgets.json' }] }

  // Performance is measured everywhere and enforced nowhere, because neither place this runs can
  // measure it honestly.
  //
  // The local bench is a Werkzeug development server with no compression, no HTTP/2 and no caching,
  // and it scores 56. Against production the run happens from whatever laptop and whatever network
  // the operator has: the same production build scored 99 and then 82 an hour later, with nothing
  // deployed in between. A budget against either number gates on the measurement rather than on
  // the site.
  //
  // What does answer the question is field data — Search Console's Core Web Vitals report, from
  // real visitors on real connections. Layout stability is enforced in `vitals.spec.js`, because
  // that is a property of the page and not of the wire.
  //
  // Accessibility, best practices and SEO do not depend on the transport, so they are held to their
  // budget everywhere.
  const enforced = Object.fromEntries(
    Object.entries(budgets).filter(([category]) => category !== 'performance'),
  )

  const chromePath = resolveChromium(appRoot)
  const pages = []
  const failures = []

  for (const route of ROUTES) {
    const outputPath = join(reportDir, `lighthouse${route === '/' ? '-index' : route.replace(/\//g, '-')}.json`)
    const result = await run(
      'yarn',
      [
        '--cwd',
        'frontend',
        'lighthouse',
        `${baseUrl}${route}`,
        '--output=json',
        `--output-path=${outputPath}`,
        '--only-categories=performance,accessibility,best-practices,seo',
        '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage',
        '--quiet',
        '--no-enable-error-reporting',
      ],
      { cwd: appRoot, env: chromePath ? { CHROME_PATH: chromePath } : {} },
    )

    if (result.code === 127) {
      return {
        status: 'skipped',
        notes: ['lighthouse is not installed. Run `yarn --cwd frontend install`.'],
        metrics: {},
        failures: [],
      }
    }

    const report = await readJson(outputPath)
    if (!report?.categories) {
      failures.push({ name: `lighthouse could not score ${route}`, detail: tail(result.stderr) })
      continue
    }

    const scores = Object.fromEntries(
      Object.entries(report.categories).map(([key, category]) => [key, Math.round(category.score * 100)]),
    )
    pages.push({ route, scores })

    for (const [category, minimum] of Object.entries(enforced)) {
      const score = scores[category]
      if (score !== undefined && score < minimum) {
        failures.push({
          name: `${route} scored ${score} for ${category}, below the budget of ${minimum}`,
          detail: topOpportunities(report),
        })
      }
    }
  }

  return {
    status: failures.length ? 'failed' : 'passed',
    metrics: metricsFor(pages),
    failures,
    notes: [
      `Performance scored ${describeScores(pages)}, measured not enforced. A development server ` +
        'and a laptop over the internet each measure themselves. Read Search Console for the ' +
        'field data that answers this.',
    ],
    pages,
  }
}

// Playwright already downloaded a Chromium, so lighthouse uses that one rather than depending on
// whichever browser the machine happens to have.
function resolveChromium(appRoot) {
  try {
    const require = createRequire(join(appRoot, 'frontend/package.json'))
    return require('playwright-core').chromium.executablePath()
  } catch {
    return null
  }
}

function describeScores(pages) {
  const scores = pages.map((page) => page.scores.performance).filter((score) => score !== undefined)
  if (!scores.length) return 'nothing'
  return `${Math.min(...scores)} to ${Math.max(...scores)}`
}

function metricsFor(pages) {
  const metrics = {}
  for (const page of pages) {
    const key = page.route === '/' ? 'index' : page.route.slice(1)
    for (const [category, score] of Object.entries(page.scores)) {
      metrics[`${key}.${category}.score`] = score
    }
  }
  return metrics
}

function topOpportunities(report) {
  return Object.values(report.audits || {})
    .filter((audit) => audit.details?.type === 'opportunity' && audit.numericValue > 100)
    .sort((left, right) => right.numericValue - left.numericValue)
    .slice(0, 5)
    .map((audit) => `${audit.title}: ${Math.round(audit.numericValue)}ms`)
    .join('\n')
}

function tail(text, lines = 10) {
  return (text || '').trim().split('\n').slice(-lines).join('\n')
}
