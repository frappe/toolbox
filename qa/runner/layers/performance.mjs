import { gzipSync } from 'node:zlib'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { readJson } from '../process.mjs'

export const id = 'performance'
export const name = 'Performance budgets'
export const tier = 'full'

// Three questions, none of which a passing test answers on its own: how much does a visitor
// download, how long does the server take to start answering, and how long does a lookup take when
// more than one person asks at once.
export async function execute({ appRoot, qaRoot, baseUrl }) {
  const budgets = await readJson(join(qaRoot, 'fixtures/budgets.json'))
  if (!budgets) return { status: 'failed', failures: [{ name: 'no budgets', detail: 'fixtures/budgets.json' }] }

  const bundle = await measureBundle(join(appRoot, 'toolbox/public/frontend'), budgets.bundle)
  const server = await measureServer(baseUrl)
  const api = await measureApi(baseUrl, budgets.api)

  const failures = [...bundle.failures, ...api.failures]
  if (server.unanswered.length) {
    failures.push({
      name: `${server.unanswered.length} routes did not answer`,
      detail: `${server.unanswered.join(', ')}. This layer needs a running bench: use \`bash qa/run-qa.sh\`.`,
    })
  } else if (server.slowest.ms > budgets.vitals.ttfbMs) {
    failures.push({
      name: `${server.slowest.route} took ${server.slowest.ms}ms to start answering`,
      detail: `The budget is ${budgets.vitals.ttfbMs}ms.`,
    })
  }

  return {
    status: failures.length ? 'failed' : 'passed',
    metrics: {
      'bundle.totalGzipKb': bundle.totalKb,
      'bundle.largestChunkGzipKb': bundle.largestKb,
      'server.ttfbMs': server.slowest.ms,
      'api.p95Ms': api.p95,
    },
    failures,
    notes: [
      `Largest chunk: ${bundle.largest} at ${bundle.largestKb} kB gzipped.`,
      `Slowest route to first byte: ${server.slowest.route} at ${server.slowest.ms}ms.`,
      `Lookup latency at ${api.concurrency} at once: p50 ${api.p50}ms, p95 ${api.p95}ms.`,
    ],
  }
}

// Gzip is what the server sends, so an uncompressed byte count answers the wrong question. Every
// emitted asset is compressed here rather than trusting the build log.
async function measureBundle(assetsRoot, budget) {
  const directory = join(assetsRoot, 'assets')
  const files = await readdir(directory).catch(() => [])
  const sized = []

  // Every emitted script and stylesheet, with nothing skipped. An earlier version passed over any
  // file above 20 MB, which meant the one chunk large enough to matter was the one the budget
  // could not see.
  for (const file of files) {
    if (!/\.(js|css)$/.test(file)) continue
    const path = join(directory, file)
    sized.push({ file, kb: Math.round(gzipSync(await readFile(path)).length / 1024) })
  }

  sized.sort((left, right) => right.kb - left.kb)
  const totalKb = sized.reduce((sum, entry) => sum + entry.kb, 0)
  const largest = sized[0] || { file: 'none', kb: 0 }

  const failures = []
  if (totalKb > budget.totalGzipKb) {
    failures.push({
      name: `The bundle is ${totalKb} kB gzipped, over the ${budget.totalGzipKb} kB budget`,
      detail: sized.slice(0, 10).map((entry) => `${entry.file} ${entry.kb} kB`).join('\n'),
    })
  }
  if (largest.kb > budget.largestChunkGzipKb) {
    failures.push({
      name: `${largest.file} is ${largest.kb} kB gzipped, over the ${budget.largestChunkGzipKb} kB chunk budget`,
      detail: 'A chunk this size delays the first render on a slow connection.',
    })
  }

  return { totalKb, largest: largest.file, largestKb: largest.kb, failures }
}

// `fetch` settles when the response headers arrive, which is the measure wanted here.
//
// A refused connection settles fastest of all, so every timing is taken only from a request that
// actually answered. Discarding that distinction once produced a report claiming a 42ms time to
// first byte from a server that was not running.
async function measureServer(baseUrl) {
  const routes = ['/', '/calculator', '/emi-calculator', '/dictionary', '/pin-code-search']
  const timings = []
  const unanswered = []

  for (const route of routes) {
    const startedAt = performance.now()
    const ok = await answered(`${baseUrl}${route}`)
    if (ok) timings.push({ route, ms: Math.round(performance.now() - startedAt) })
    else unanswered.push(route)
  }

  timings.sort((left, right) => right.ms - left.ms)
  return { timings, unanswered, slowest: timings[0] || { route: 'none', ms: 0 } }
}

async function measureApi(baseUrl, budget) {
  const endpoint = `${baseUrl}/api/method/toolbox.india_business.search_pin?query=110001`
  const durations = []
  let unanswered = 0

  for (let batch = 0; batch < budget.requestsPerEndpoint / budget.concurrency; batch += 1) {
    await Promise.all(
      Array.from({ length: budget.concurrency }, async () => {
        const startedAt = performance.now()
        if (await answered(endpoint)) durations.push(performance.now() - startedAt)
        else unanswered += 1
      }),
    )
  }

  durations.sort((left, right) => left - right)
  const at = (fraction) => Math.round(durations[Math.floor(durations.length * fraction)] || 0)
  const p95 = at(0.95)

  const failures = []
  if (unanswered) {
    failures.push({
      name: `${unanswered} of ${unanswered + durations.length} lookups did not answer`,
      detail: 'The measurement needs a running bench. Use `bash qa/run-qa.sh`, which starts one.',
    })
  } else if (p95 > budget.p95Ms) {
    failures.push({
      name: `A PIN lookup takes ${p95}ms at the 95th percentile, over the ${budget.p95Ms}ms budget`,
      detail: `Measured with ${budget.concurrency} requests in flight at once.`,
    })
  }

  return { p50: at(0.5), p95, concurrency: budget.concurrency, failures }
}

async function answered(url) {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}
