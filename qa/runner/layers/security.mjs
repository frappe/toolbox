import { join } from 'node:path'

import { run } from '../process.mjs'

export const id = 'security'
export const name = 'Security (code and dependencies)'
export const tier = 'full'

// The HTTP side of security — headers, guest writes, injection payloads, rate limits — runs as
// Playwright specs in the browser layer, because it needs the site up and the same fixtures. This
// layer is the part that reads the source and the installed packages instead.
//
// Every tool here runs through `uvx`, so nothing is installed into the bench environment. A QA
// tool must never change what the application runs on.
export async function execute({ appRoot, benchRoot }) {
  const steps = await Promise.all([auditNode(appRoot), auditPython(benchRoot), scanSource(appRoot)])

  const failures = steps
    .filter((step) => step.status === 'failed')
    .map((step) => ({ name: step.name, detail: step.detail }))

  const notes = steps
    .filter((step) => step.note || step.status === 'skipped')
    .map((step) => `${step.name}: ${step.note || step.detail}`)

  return {
    status: failures.length ? 'failed' : 'passed',
    metrics: Object.assign({}, ...steps.map((step) => step.metrics || {})),
    failures,
    notes,
    steps,
  }
}

// An advisory in a package that reaches a visitor's browser fails the run. One in a build tool is
// reported instead. A gate that goes red for something the project cannot act on gets ignored, and
// then it guards nothing.
//
// Yarn 1 cannot make that distinction on its own. `--groups dependencies` is the closest it
// offers, and it still reports a package hoisted out of a build tool, so the few that are
// established as build-only are named here with the evidence. Check the entry before adding one:
// `yarn why <package>` has to show a build tool as the only path, and the name must be absent from
// `toolbox/public/frontend/assets`.
const BUILD_ONLY_PACKAGES = {
  // `yarn why nanoid` (2026-08-14): reached only through postcss, itself hoisted out of
  // tailwindcss, vite and @vue/compiler-sfc. Absent from the built assets.
  nanoid: 'postcss, a build tool, is its only path',
}

async function auditNode(appRoot) {
  const result = await run('yarn', ['--cwd', 'frontend', 'audit', '--groups', 'dependencies', '--json'], {
    cwd: appRoot,
  })
  if (result.code === 127) {
    return { name: 'yarn audit', status: 'skipped', detail: 'yarn is not on the path' }
  }

  const advisories = distinct(
    jsonLines(result.stdout)
      .filter((entry) => entry.type === 'auditAdvisory')
      .map((entry) => ({
        module: entry.data.advisory.module_name,
        severity: entry.data.advisory.severity,
        title: entry.data.advisory.title,
      })),
  )

  const serious = advisories.filter((entry) => ['high', 'critical'].includes(entry.severity))
  const shipped = serious.filter((entry) => !BUILD_ONLY_PACKAGES[entry.module])
  const buildOnly = serious.filter((entry) => BUILD_ONLY_PACKAGES[entry.module])
  const lesser = advisories.filter((entry) => !['high', 'critical'].includes(entry.severity))

  return {
    name: 'yarn audit',
    status: shipped.length ? 'failed' : 'passed',
    detail: shipped.length
      ? shipped.map((entry) => `${entry.module} (${entry.severity}): ${entry.title}`).join('\n')
      : `${advisories.length} advisories, none high or critical in a package that ships`,
    note: [
      buildOnly.length && `build-only, not shipped: ${unique(buildOnly)}`,
      lesser.length && `below high severity: ${unique(lesser)}`,
    ]
      .filter(Boolean)
      .join('. '),
    metrics: { nodeAdvisories: shipped.length, nodeAdvisoriesBuildOnly: buildOnly.length },
  }
}

// The bench environment belongs to Frappe. `pyproject.toml` declares no Python dependency of
// Toolbox's own, so nothing found here is Toolbox's to upgrade, and on Frappe Cloud the platform
// owns the image. It is reported so somebody knows, and it does not fail the run.
async function auditPython(benchRoot) {
  const sitePackages = join(benchRoot, 'env/lib/python3.14/site-packages')
  const result = await run('uvx', ['pip-audit', '--format=json', '--path', sitePackages])
  if (result.code === 127) {
    return { name: 'pip-audit', status: 'skipped', detail: 'uv is not on the path' }
  }

  const report = parseJson(result.stdout)
  if (!report) {
    return { name: 'pip-audit', status: 'skipped', detail: tail(result.stderr) }
  }

  const vulnerable = (report.dependencies || []).filter((entry) => entry.vulns?.length)
  return {
    name: 'pip-audit',
    status: 'passed',
    detail: vulnerable.length
      ? vulnerable
          .map((entry) => `${entry.name} ${entry.version}: ${entry.vulns.map((v) => v.id).join(', ')}`)
          .join('\n')
      : `${report.dependencies?.length || 0} packages, no known advisories`,
    note: vulnerable.length
      ? `${vulnerable.length} packages in the shared bench environment carry advisories. ` +
        'Toolbox declares no Python dependency of its own, so these belong to Frappe and the ' +
        'platform image: ' +
        vulnerable.map((entry) => entry.name).join(', ')
      : '',
    metrics: { pythonAdvisories: vulnerable.length },
  }
}

async function scanSource(appRoot) {
  const result = await run(
    'uvx',
    [
      'semgrep',
      'scan',
      '--config=p/python',
      '--config=p/javascript',
      '--config=p/secrets',
      '--json',
      '--quiet',
      '--metrics=off',
      '--exclude=node_modules',
      '--exclude=frontend/test-results',
      '--exclude=toolbox/public/frontend',
      '.',
    ],
    { cwd: appRoot },
  )

  const report = parseJson(result.stdout)
  if (!report) {
    // The rulesets come from the semgrep registry, so a machine with no network cannot run this.
    // That is a gap in the run, not a pass.
    return { name: 'semgrep', status: 'skipped', detail: tail(result.stderr) || 'no rules available' }
  }

  const findings = report.results || []
  const serious = findings.filter((finding) => finding.extra?.severity === 'ERROR')
  return {
    name: 'semgrep',
    status: serious.length ? 'failed' : 'passed',
    detail: serious.length
      ? serious.map((f) => `${f.path}:${f.start?.line} ${f.check_id}`).join('\n')
      : `${findings.length} findings, none at error severity`,
    metrics: { semgrepFindings: findings.length, semgrepErrors: serious.length },
  }
}

// Yarn 1 writes one JSON object per line rather than one document.
function jsonLines(stdout) {
  return stdout
    .trim()
    .split('\n')
    .map(parseJson)
    .filter(Boolean)
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// One advisory reaches a package through several paths, and yarn writes a line for each.
function distinct(advisories) {
  const byModule = new Map()
  for (const entry of advisories) byModule.set(`${entry.module}:${entry.title}`, entry)
  return [...byModule.values()]
}

function unique(advisories) {
  return [...new Set(advisories.map((entry) => entry.module))].join(', ')
}

function tail(text, lines = 10) {
  return (text || '').trim().split('\n').slice(-lines).join('\n')
}
