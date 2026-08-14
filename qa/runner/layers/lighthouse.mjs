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

  // The local bench is a Werkzeug development server: no compression, no HTTP/2, no caching. It
  // scores 56 for performance where the same build behind the Frappe Cloud proxy scores 99, so a
  // performance budget applied locally measures the server rather than the application. The other
  // three categories do not depend on the transport, so they are held to their budget everywhere.
  const local = /localhost|127\.0\.0\.1/.test(baseUrl)
  const enforced = local
    ? Object.fromEntries(Object.entries(budgets).filter(([category]) => category !== 'performance'))
    : budgets

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
    notes: local
      ? [
          'Performance is measured but not enforced against the local bench: an uncompressed ' +
            'development server scores far below the same build in production. ' +
            'Run `bash qa/run-qa.sh --target=prod` to hold it to the budget.',
        ]
      : [],
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
