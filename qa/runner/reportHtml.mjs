// One self-contained page, so a report can be opened from anywhere without the runner or a server.
export function renderHtml(summary, table, columns, mark) {
  const failures = summary.layers.flatMap((layer) =>
    (layer.failures || []).map((failure) => ({ ...failure, layer: layer.name })),
  )

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Toolbox QA — ${escape(summary.startedAt.slice(0, 16).replace('T', ' '))}</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <h1>Toolbox QA</h1>
  <p class="verdict ${summary.status}">${escape(headline(summary, table))}</p>
  <p class="meta">
    ${escape(summary.startedAt.slice(0, 16).replace('T', ' '))} ·
    <code>${escape(summary.branch)}</code> at <code>${escape(summary.commit)}</code> ·
    ${escape(summary.target)} · ${escape(summary.tier)} run ·
    ${Math.round(summary.durationMs / 1000)}s
  </p>
</header>

<section>
  <h2>Tools <span class="count">${table.length}</span></h2>
  <table>
    <thead><tr><th>Tool</th>${columns.map((c) => `<th>${escape(c.label)}</th>`).join('')}</tr></thead>
    <tbody>
      ${table
        .map(
          (row) => `<tr class="${row.status}">
        <td>${escape(row.name)}</td>
        ${columns
          .map((column) => {
            const state = row.checks[column.key]
            return `<td class="cell ${state}" title="${escape(state)}">${mark[state]}</td>`
          })
          .join('')}
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>
  <p class="key">${mark.passed} pass · ${mark.failed} fail · ${mark.skipped} skipped · ${mark.missing} no test</p>
</section>

<section>
  <h2>Layers</h2>
  <table>
    <thead><tr><th>Layer</th><th>Result</th><th>Numbers</th><th>Time</th></tr></thead>
    <tbody>
      ${summary.layers
        .map(
          (layer) => `<tr class="${layer.status}">
        <td>${escape(layer.name)}</td>
        <td class="cell ${layer.status}">${mark[layer.status] || ''} ${escape(layer.status)}</td>
        <td class="numbers">${escape(metricText(layer.metrics))}</td>
        <td>${Math.round(layer.durationMs / 1000)}s</td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>
</section>

${regressionSection(summary)}

${
  failures.length
    ? `<section>
  <h2>Failures <span class="count">${failures.length}</span></h2>
  ${failures
    .map(
      (failure) => `<details>
    <summary><span class="layer">${escape(failure.layer)}</span> ${escape(failure.name)}</summary>
    <pre>${escape((failure.detail || '').trim())}</pre>
  </details>`,
    )
    .join('')}
</section>`
    : ''
}
</body>
</html>
`
}

function headline(summary, table) {
  if (summary.status === 'passed' && !summary.baseline?.regressions?.length) {
    return 'Everything passed, with no regression against the baseline.'
  }
  const failedTools = table.filter((row) => row.status === 'failed').length
  const failedLayers = summary.layers.filter((layer) => layer.status === 'failed').length
  const regressions = summary.baseline?.regressions?.length || 0
  return [
    failedTools ? `${failedTools} tools failing` : '',
    failedLayers ? `${failedLayers} layers failing` : '',
    regressions ? `${regressions} regressions` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function regressionSection(summary) {
  const regressions = summary.baseline?.regressions || []
  if (!regressions.length) return ''
  return `<section>
  <h2>Regressions against the baseline</h2>
  <table>
    <thead><tr><th>Measure</th><th>Before</th><th>Now</th><th>Change</th></tr></thead>
    <tbody>
      ${regressions
        .map(
          (item) => `<tr class="failed">
        <td>${escape(item.key)} <span class="layer">${escape(item.label)}</span></td>
        <td>${item.before}</td><td>${item.after}</td>
        <td>${item.delta > 0 ? '+' : ''}${Math.round(item.delta * 100) / 100}</td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>
</section>`
}

function metricText(metrics = {}) {
  return (
    Object.entries(metrics)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => `${key} ${value}`)
      .join(', ') || '—'
  )
}

function escape(value) {
  return String(value ?? '').replace(
    /[&<>"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character],
  )
}

const STYLE = `
:root {
  --bg: #fff; --fg: #171717; --muted: #737373; --line: #e5e5e5; --panel: #fafafa;
  --pass: #14804a; --fail: #b91c1c; --warn: #b45309; --none: #a3a3a3;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #171717; --fg: #ededed; --muted: #a3a3a3; --line: #333; --panel: #1f1f1f;
    --pass: #4ade80; --fail: #f87171; --warn: #fbbf24; --none: #666;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0 auto; padding: 2rem 1.25rem; max-width: 60rem; background: var(--bg); color: var(--fg);
  font: 15px/1.6 ui-sans-serif, -apple-system, "Segoe UI", sans-serif;
}
h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
h2 { font-size: 1.05rem; margin: 2rem 0 .75rem; display: flex; align-items: center; gap: .5rem; }
.count { font-size: .75rem; color: var(--muted); font-weight: 400; }
.verdict { font-size: 1.1rem; font-weight: 600; margin: .25rem 0; }
.verdict.passed { color: var(--pass); }
.verdict.failed { color: var(--fail); }
.meta { color: var(--muted); font-size: .85rem; margin: 0; }
code { background: var(--panel); padding: .1em .35em; border-radius: 3px; font-size: .85em; }
table { width: 100%; border-collapse: collapse; font-size: .9rem; }
th, td { text-align: left; padding: .4rem .6rem; border-bottom: 1px solid var(--line); }
th { font-weight: 600; color: var(--muted); font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; }
td.cell { text-align: center; font-weight: 700; width: 5.5rem; }
.cell.passed { color: var(--pass); }
.cell.failed { color: var(--fail); }
.cell.flaky { color: var(--warn); }
.cell.skipped, .cell.missing { color: var(--none); }
tr.failed td:first-child { font-weight: 600; }
.numbers { color: var(--muted); font-size: .82rem; }
.key { color: var(--muted); font-size: .8rem; }
.layer { color: var(--muted); font-size: .8em; }
details { border: 1px solid var(--line); border-radius: 6px; margin-bottom: .5rem; background: var(--panel); }
summary { cursor: pointer; padding: .5rem .75rem; font-size: .88rem; }
pre {
  margin: 0; padding: .75rem; border-top: 1px solid var(--line); overflow-x: auto;
  font-size: .8rem; white-space: pre-wrap; word-break: break-word;
}
`
