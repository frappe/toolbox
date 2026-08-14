import { writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as baselineStore from './baseline.mjs'
import * as backend from './layers/backend.mjs'
import * as browser from './layers/browser.mjs'
import * as lighthouse from './layers/lighthouse.mjs'
import * as performance from './layers/performance.mjs'
import * as security from './layers/security.mjs'
import * as staticGates from './layers/static.mjs'
import * as units from './layers/units.mjs'
import { ensureDir, run } from './process.mjs'
import { writeReport } from './report.mjs'

// The order is deliberate. The build has to finish before anything opens a page, and the browser
// matrix has to be alone on the machine, so the two audit layers that need no server run after it
// rather than beside it.
const LAYERS = [staticGates, units, backend, browser, performance, security, lighthouse]

const qaRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = resolve(qaRoot, '..')
const benchRoot = resolve(appRoot, '../..')

const PRODUCTION_URL = 'https://frappe.tools'

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const startedAt = new Date()
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const reportDir = join(qaRoot, 'reports', stamp)
  await ensureDir(reportDir)

  const { tools } = await import(join(appRoot, 'frontend/src/data/toolRegistry.js'))
  const context = {
    appRoot,
    benchRoot,
    qaRoot,
    reportDir,
    site: process.env.TOOLBOX_TEST_SITE || 'toolbox-test.localhost',
    baseUrl: options.target === 'prod' ? PRODUCTION_URL : 'http://toolbox-test.localhost:8100',
    target: options.target,
    fast: options.fast,
    updateVisual: options.updateVisual,
  }

  const selected = LAYERS.filter((layer) => {
    if (options.layers.length) return options.layers.includes(layer.id)
    if (options.fast) return layer.tier === 'fast'
    // Against production nothing may be built, linted or written. Only the read-only layers run.
    if (options.target === 'prod') return layer.readOnly
    return true
  })

  const layers = []
  for (const layer of selected) {
    process.stdout.write(`\n── ${layer.name} ──\n`)
    const startedLayer = Date.now()
    let result
    try {
      result = await layer.execute(context)
    } catch (error) {
      result = { status: 'failed', failures: [{ name: 'layer crashed', detail: error.stack }] }
    }
    const finished = {
      id: layer.id,
      name: layer.name,
      durationMs: Date.now() - startedLayer,
      metrics: {},
      failures: [],
      ...result,
    }
    layers.push(finished)
    process.stdout.write(`   ${finished.status} in ${Math.round(finished.durationMs / 1000)}s\n`)
    await writeFile(join(reportDir, `${layer.id}.log`), finished.log || '')
  }

  const metrics = flattenMetrics(layers)
  const baselinePath = join(qaRoot, 'baseline.json')
  const baseline = await baselineStore.compare(metrics, baselinePath)
  const { branch, commit } = await describeRepo()

  const summary = {
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    tier: options.fast ? 'fast' : options.layers.length ? 'partial' : 'full',
    target: options.target === 'prod' ? PRODUCTION_URL : context.baseUrl,
    branch,
    commit,
    layers,
    metrics,
    baseline,
    status:
      layers.every((layer) => layer.status === 'passed') && !baseline.regressions.length
        ? 'passed'
        : 'failed',
  }

  const { markdown } = await writeReport(summary, { reportDir, tools })
  process.stdout.write(`\n${markdown.split('\n').slice(0, 12).join('\n')}\n`)
  process.stdout.write(`\nFull report: ${join(reportDir, 'report.md')}\n`)
  process.stdout.write(`            ${join(reportDir, 'report.html')}\n`)

  // A baseline is only worth recording from a complete, green run. Writing one from a partial or
  // failing run would lower the bar to whatever just happened.
  if (options.updateBaseline) {
    if (summary.status === 'passed' && summary.tier === 'full') {
      await baselineStore.write(baselinePath, { metrics, commit })
      process.stdout.write('\nBaseline updated.\n')
    } else {
      process.stdout.write('\nBaseline not updated: it takes a full run that passed.\n')
    }
  }

  process.exit(summary.status === 'passed' ? 0 : 1)
}

function parseArgs(argv) {
  const options = { fast: false, layers: [], target: 'local', updateVisual: false, updateBaseline: false }
  for (const arg of argv) {
    if (arg === '--fast') options.fast = true
    else if (arg === '--update-visual') options.updateVisual = true
    else if (arg === '--update-baseline') options.updateBaseline = true
    else if (arg.startsWith('--layer=')) options.layers = arg.slice(8).split(',')
    else if (arg.startsWith('--target=')) options.target = arg.slice(9)
  }
  return options
}

function flattenMetrics(layers) {
  const metrics = {}
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer.metrics || {})) {
      metrics[`${layer.id}.${key}`] = value
    }
  }
  return metrics
}

async function describeRepo() {
  const branch = await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: appRoot })
  const commit = await run('git', ['rev-parse', '--short', 'HEAD'], { cwd: appRoot })
  return { branch: branch.stdout.trim() || 'unknown', commit: commit.stdout.trim() || 'unknown' }
}

main()
