import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { renderHtml } from './reportHtml.mjs'

// The question this report answers first is "does each tool work". So the tool table comes before
// the layer table, and a reader who stops after the first screen has the answer.
const CHECK_COLUMNS = [
  { key: 'correctness', label: 'Correct', groups: ['Tool correctness', 'Tool workflows'] },
  { key: 'accessibility', label: 'A11y', groups: ['Accessibility'] },
  { key: 'mobile', label: 'Mobile', groups: ['Mobile fit'] },
  { key: 'visual', label: 'Visual', groups: ['Visual regression'] },
  {
    key: 'offline',
    label: 'Offline',
    groups: ['Offline and PWA'],
    // A tool that reads a server dataset does not claim to work offline, and the All Tools page
    // says so. Printing it as a missing test would send somebody looking for a gap that is a
    // decision.
    appliesTo: (tool) => tool.offlineCapability === 'full',
  },
]

const MARK = { passed: '✓', failed: '✗', skipped: '–', flaky: '~', missing: '·', na: ' ' }

export async function writeReport(summary, { reportDir, tools }) {
  const table = buildToolTable(summary, tools)
  const markdown = renderMarkdown(summary, table)

  await writeFile(join(reportDir, 'report.md'), markdown)
  await writeFile(join(reportDir, 'report.json'), `${JSON.stringify({ ...summary, table }, null, 2)}\n`)
  await writeFile(join(reportDir, 'report.html'), renderHtml(summary, table, CHECK_COLUMNS, MARK))

  return { markdown, table }
}

// A tool with no result for a check is not a pass. It is a gap, and the report marks it so, because
// a blank cell is how six tools went a whole release without an accessibility scan.
export function buildToolTable(summary, tools) {
  const results = summary.layers.flatMap((layer) => layer.toolResults || [])

  return tools.map((tool) => {
    const row = { id: tool.id, name: tool.name, category: tool.category, checks: {} }
    for (const column of CHECK_COLUMNS) {
      if (column.appliesTo && !column.appliesTo(tool)) {
        row.checks[column.key] = 'na'
        continue
      }
      const relevant = results.filter(
        (result) => result.toolId === tool.id && columnOf(result) === column.key,
      )
      row.checks[column.key] = verdictOf(relevant)
    }
    row.status = Object.values(row.checks).includes('failed') ? 'failed' : 'passed'
    return row
  })
}

function columnOf(result) {
  if (CHECK_COLUMNS.some((column) => column.key === result.check)) return result.check
  return CHECK_COLUMNS.find((column) => column.groups.includes(result.check))?.key || null
}

// A check runs once per engine, and several are deliberately one engine's alone — the dark-mode
// scan, the keyboard walk. So a skip beside a pass is a pass. Only a check that ran nowhere is
// reported as skipped, and only a check with no test at all is a gap.
function verdictOf(results) {
  if (!results.length) return 'missing'
  if (results.some((result) => result.status === 'failed')) return 'failed'
  if (results.some((result) => result.status === 'flaky')) return 'flaky'
  if (results.some((result) => result.status === 'passed')) return 'passed'
  return 'skipped'
}

function renderMarkdown(summary, table) {
  const lines = []
  const failedTools = table.filter((row) => row.status === 'failed')
  const gaps = table.filter((row) => Object.values(row.checks).includes('missing'))

  lines.push(`# Toolbox QA — ${summary.startedAt.slice(0, 16).replace('T', ' ')}`)
  lines.push('')
  lines.push(verdict(summary, failedTools))
  lines.push('')
  lines.push(
    `Branch \`${summary.branch}\` at \`${summary.commit}\` · target ${summary.target} · ` +
      `${summary.tier} run · ${Math.round(summary.durationMs / 1000)}s`,
  )
  lines.push('')

  lines.push(`## Tools (${table.length})`)
  lines.push('')
  lines.push(`| Tool | ${CHECK_COLUMNS.map((column) => column.label).join(' | ')} |`)
  lines.push(`| --- | ${CHECK_COLUMNS.map(() => '---').join(' | ')} |`)
  for (const row of table) {
    const cells = CHECK_COLUMNS.map((column) => MARK[row.checks[column.key]])
    lines.push(`| ${row.name} | ${cells.join(' | ')} |`)
  }
  lines.push('')
  lines.push(
    `Key: ${MARK.passed} pass · ${MARK.failed} fail · ${MARK.skipped} skipped everywhere · ` +
      `${MARK.missing} no test · blank not applicable`,
  )
  if (gaps.length) {
    lines.push('')
    lines.push(`**${gaps.length} tools have a check with no test.** ${gaps.map((row) => row.name).join(', ')}.`)
  }
  lines.push('')

  lines.push('## Layers')
  lines.push('')
  lines.push('| Layer | Result | Numbers | Time |')
  lines.push('| --- | --- | --- | --- |')
  for (const layer of summary.layers) {
    lines.push(
      `| ${layer.name} | ${MARK[layer.status] || layer.status} ${layer.status} | ` +
        `${describeMetrics(layer.metrics)} | ${Math.round(layer.durationMs / 1000)}s |`,
    )
  }
  lines.push('')

  if (summary.baseline?.regressions?.length) {
    lines.push('## Regressions against the baseline')
    lines.push('')
    lines.push('| Measure | Before | Now | Change |')
    lines.push('| --- | --- | --- | --- |')
    for (const item of summary.baseline.regressions) {
      lines.push(`| ${item.key} (${item.label}) | ${item.before} | ${item.after} | ${signed(item.delta)} |`)
    }
    lines.push('')
  }

  const failures = summary.layers.flatMap((layer) =>
    (layer.failures || []).map((failure) => ({ ...failure, layer: layer.name })),
  )
  if (failures.length) {
    lines.push(`## Failures (${failures.length})`)
    lines.push('')
    for (const failure of failures.slice(0, 60)) {
      lines.push(`### ${failure.layer} — ${failure.name}`)
      lines.push('')
      if (failure.detail) {
        lines.push('```')
        lines.push(failure.detail.trim())
        lines.push('```')
        lines.push('')
      }
    }
    if (failures.length > 60) lines.push(`_${failures.length - 60} more in report.json._`)
    lines.push('')
  }

  const notes = summary.layers.flatMap((layer) => layer.notes || [])
  if (notes.length) {
    lines.push('## Notes')
    lines.push('')
    for (const note of notes) lines.push(`- ${note}`)
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function verdict(summary, failedTools) {
  if (summary.status === 'passed' && !summary.baseline?.regressions?.length) {
    const count = summary.layers.length
    return `**Everything passed.** ${count} ${count === 1 ? 'layer' : 'layers'}, no regression against the baseline.`
  }
  const parts = []
  if (failedTools.length) parts.push(`${failedTools.length} tools failing`)
  const failedLayers = summary.layers.filter((layer) => layer.status === 'failed')
  if (failedLayers.length) parts.push(`${failedLayers.length} layers failing`)
  if (summary.baseline?.regressions?.length) {
    parts.push(`${summary.baseline.regressions.length} regressions against the baseline`)
  }
  return `**${parts.join(', ') || 'Run did not finish'}.**`
}

// Lighthouse alone reports four scores for each of five routes. The whole set goes to report.json;
// the table keeps the row readable.
function describeMetrics(metrics = {}, limit = 6) {
  const parts = Object.entries(metrics)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key} ${value}`)
  if (!parts.length) return '—'
  if (parts.length <= limit) return parts.join(', ')
  return `${parts.slice(0, limit).join(', ')}, and ${parts.length - limit} more`
}

function signed(delta) {
  const rounded = Math.round(delta * 100) / 100
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}
