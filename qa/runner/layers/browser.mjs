import { join } from 'node:path'

import { readJson, run } from '../process.mjs'

export const id = 'browser'
export const name = 'Browser matrix'
export const tier = 'fast'
export const readOnly = true

// The whole Playwright matrix runs once. Splitting it into a functional run, an accessibility run
// and a visual run would start the browsers three times and, worse, would put two matrices near
// each other: two at once starve the single web server and every spec then fails on a 30-second
// navigation timeout that reads like a real regression. So one run, and the results are grouped
// for the report afterwards by the spec file that produced them.
const GROUPS = {
  correctness: 'Tool correctness',
  accessibility: 'Accessibility',
  responsive: 'Mobile fit',
  visual: 'Visual regression',
  offline: 'Offline and PWA',
  navigation: 'Navigation integrity',
  storage: 'Storage invariants',
  'api-contract': 'API contracts',
  'security-http': 'Security (HTTP)',
  vitals: 'Core Web Vitals',
  csp: 'Content-Security-Policy',
}

export async function execute({ appRoot, reportDir, fast, updateVisual, baseUrl }) {
  const resultsPath = join(reportDir, 'playwright.json')
  const args = ['--cwd', 'frontend', 'playwright', 'test', '--reporter=list,json']
  if (fast) args.push('--project=chromium', '--grep', '@smoke')
  if (updateVisual) args.push('--update-snapshots')

  const result = await run('yarn', args, {
    cwd: appRoot,
    echo: true,
    env: {
      PLAYWRIGHT_JSON_OUTPUT_NAME: resultsPath,
      TOOLBOX_E2E_BASE_URL: baseUrl,
    },
  })

  const report = await readJson(resultsPath)
  if (!report) {
    return {
      status: 'failed',
      metrics: {},
      failures: [{ name: 'Playwright wrote no report', detail: tail(result.stderr || result.stdout) }],
    }
  }

  const specs = collectSpecs(report)

  // A run that collapsed before it collected a test is not a run that found nothing wrong. A bad
  // import in one spec stops the whole matrix loading, and this layer reported that as a pass
  // until the first full run caught it doing so.
  if (!specs.length || report.errors?.length) {
    return {
      status: 'failed',
      metrics: { tests: 0 },
      failures: [
        {
          name: specs.length ? 'Playwright reported a run-level error' : 'Playwright ran no tests',
          detail:
            (report.errors || []).map((error) => error.message).join('\n') ||
            tail(result.stdout || result.stderr),
        },
      ],
    }
  }
  const failures = specs
    .filter((spec) => spec.status === 'failed')
    .map((spec) => ({
      name: `${spec.group} › ${spec.title} (${spec.project})`,
      detail: spec.error,
      durationMs: spec.durationMs,
    }))

  return {
    status: failures.length ? 'failed' : 'passed',
    metrics: {
      tests: report.stats?.expected + report.stats?.unexpected || specs.length,
      passed: report.stats?.expected ?? null,
      failed: report.stats?.unexpected ?? null,
      flaky: report.stats?.flaky ?? null,
      skipped: report.stats?.skipped ?? null,
      seconds: report.stats?.duration ? Math.round(report.stats.duration / 1000) : null,
    },
    groups: summarizeGroups(specs),
    toolResults: specs.filter((spec) => spec.tool).map(toToolResult),
    failures,
    // A run where every spec times out is a starved bench, not 300 regressions. The report says so
    // rather than leaving the reader to check durations one by one.
    notes: starvationNote(specs),
  }
}

function collectSpecs(report) {
  const found = []

  const walk = (suite, file) => {
    const specFile = suite.file || file
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const last = test.results?.[test.results.length - 1] || {}
        found.push({
          title: spec.title,
          file: specFile,
          group: groupOf(specFile),
          project: test.projectName,
          status: statusOf(test, last),
          durationMs: last.duration ?? 0,
          tool: annotation(test, 'tool'),
          check: annotation(test, 'check'),
          error: [last.error?.message, last.error?.snippet].filter(Boolean).join('\n').slice(0, 2000),
        })
      }
    }
    for (const child of suite.suites || []) walk(child, specFile)
  }

  for (const suite of report.suites || []) walk(suite, suite.file)
  return found
}

function statusOf(test, last) {
  if (test.status === 'skipped' || last.status === 'skipped') return 'skipped'
  if (test.status === 'expected' || last.status === 'passed') return 'passed'
  if (test.status === 'flaky') return 'flaky'
  return 'failed'
}

function annotation(test, type) {
  return (test.annotations || []).find((entry) => entry.type === type)?.description || null
}

function groupOf(file = '') {
  const stem = file.split('/').pop()?.replace('.spec.js', '') || 'other'
  return GROUPS[stem] || 'Tool workflows'
}

function summarizeGroups(specs) {
  const groups = {}
  for (const spec of specs) {
    const group = (groups[spec.group] ||= { passed: 0, failed: 0, skipped: 0, flaky: 0 })
    group[spec.status] += 1
  }
  return groups
}

function toToolResult(spec) {
  return {
    toolId: spec.tool,
    check: spec.check || spec.group,
    status: spec.status,
    project: spec.project,
    detail: spec.status === 'failed' ? spec.error : '',
  }
}

// A timeout-shaped failure has two very different causes, and the duration alone cannot tell them
// apart. What tells them apart is the blast radius.
//
// A starved machine slows everything, so the tests that still passed are slow too. A single slow
// locator, or a lookup against local data that is missing a row, leaves everything around it fast.
// Reading only the failures says "timeout" in both cases and sends the reader to the wrong place —
// this checks what the passing tests did as well.
// Exported so it can be exercised directly. It is the one piece of the report that offers a
// diagnosis rather than a number, and a wrong diagnosis sends the reader to the wrong place.
export function starvationNote(specs) {
  const failed = specs.filter((spec) => spec.status === 'failed')
  const timedOut = failed.filter((spec) => spec.durationMs >= 29_000)
  if (!timedOut.length || timedOut.length < failed.length * 0.8) return []

  const passedDurations = specs
    .filter((spec) => spec.status === 'passed')
    .map((spec) => spec.durationMs)
    .sort((left, right) => left - right)
  const typical = passedDurations[Math.floor(passedDurations.length / 2)] ?? 0

  if (typical >= 10_000) {
    return [
      `${timedOut.length} of ${failed.length} failures sat at the 30s test timeout, and the tests ` +
        `that passed took ${Math.round(typical / 1000)}s each. Everything was slow, which is a ` +
        'starved web server rather than a regression. Repeat the run with nothing else on the machine.',
    ]
  }

  return [
    `${timedOut.length} of ${failed.length} failures sat at the 30s test timeout, but the tests ` +
      `that passed took ${(typical / 1000).toFixed(1)}s each. The machine was not the problem: ` +
      'a timeout with everything around it fast points at the thing being waited for — one ' +
      'locator, or a lookup whose local data is missing the row. Check that before blaming the run.',
  ]
}

function tail(text, lines = 25) {
  return text.trim().split('\n').slice(-lines).join('\n')
}
