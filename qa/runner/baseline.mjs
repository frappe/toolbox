import { writeFile } from 'node:fs/promises'

import { readJson } from './process.mjs'

// A green run is not the same as no regression. A deleted test lowers the count and every
// remaining test still passes. A chunk that grows by a third still loads. These rules turn the
// numbers a run produces into pass or fail on their own.
//
// `direction` is the direction that is allowed to change without comment.
const RULES = [
  { match: /\.tests$/, direction: 'up', tolerance: 0, label: 'test count' },
  { match: /\.files$/, direction: 'up', tolerance: 0, label: 'test file count' },
  { match: /\.lineCoverage$/, direction: 'up', tolerance: 0.5, label: 'line coverage' },
  { match: /\.bytes$/, direction: 'down', tolerance: 5, unit: '%', label: 'bundle size' },
  { match: /\.lcpMs$/, direction: 'down', tolerance: 20, unit: '%', label: 'largest contentful paint' },
  { match: /\.ttfbMs$/, direction: 'down', tolerance: 30, unit: '%', label: 'time to first byte' },
  { match: /\.score$/, direction: 'up', tolerance: 3, label: 'lighthouse score' },
  // Debt that predates the suite is recorded rather than cleared. It may shrink, never grow.
  { match: /\.ruff(Findings|UnformattedFiles)$/, direction: 'down', tolerance: 0, label: 'ruff debt' },
  // Wall time moves with whatever else the machine is doing, so it is reported and never fails.
  { match: /(Ms|seconds)$/, direction: 'any', label: 'duration' },
]

export async function compare(metrics, baselinePath) {
  const baseline = await readJson(baselinePath)
  if (!baseline) return { available: false, regressions: [], changes: [] }

  const regressions = []
  const changes = []

  for (const [key, value] of Object.entries(metrics)) {
    const before = baseline.metrics?.[key]
    if (typeof value !== 'number' || typeof before !== 'number') continue

    const rule = RULES.find((candidate) => candidate.match.test(key))
    if (!rule || rule.direction === 'any') continue

    const delta = value - before
    if (delta === 0) continue

    const allowed = rule.unit === '%' ? Math.abs(before * (rule.tolerance / 100)) : rule.tolerance
    const worsened = rule.direction === 'up' ? delta < 0 : delta > 0
    const change = { key, label: rule.label, before, after: value, delta }

    if (worsened && Math.abs(delta) > allowed) regressions.push(change)
    else changes.push(change)
  }

  return { available: true, capturedAt: baseline.capturedAt, commit: baseline.commit, regressions, changes }
}

export async function write(baselinePath, { metrics, commit }) {
  const baseline = {
    capturedAt: new Date().toISOString(),
    commit,
    // Only numbers are worth keeping. A metric that is null this run would otherwise overwrite a
    // good number with nothing, and the next run would have no baseline to compare against.
    metrics: Object.fromEntries(
      Object.entries(metrics).filter(([, value]) => typeof value === 'number'),
    ),
  }
  await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`)
  return baseline
}
