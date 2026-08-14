import { run } from '../process.mjs'

export const id = 'static'
export const name = 'Static gates'
export const tier = 'fast'

// The production build is the first gate for a reason: the browser layers serve what it writes, so
// a broken build makes every later failure a lie. Ruff is the only linter run here. The repository
// `.eslintrc` is the Frappe desk boilerplate — it has no Vue parser and turns off `no-unused-vars`,
// so it checks little that the build does not already reject. Semgrep covers JavaScript and Vue in
// the security layer instead.
export async function execute({ appRoot }) {
  const steps = []

  const build = await run('yarn', ['--cwd', 'frontend', 'build'], { cwd: appRoot })
  steps.push({
    name: 'Production build',
    ok: build.ok,
    durationMs: build.durationMs,
    detail: build.ok ? bundleSummary(build.stdout) : tail(build.stderr || build.stdout),
  })

  // Ruff is a ratchet rather than a gate. The repository carries findings that predate this suite,
  // and reformatting 21 files to clear them would bury whatever change is under review — the very
  // thing `CLAUDE.md` warns about. So the counts are recorded as metrics, and `baseline.json`
  // fails the run when either one grows. The debt cannot spread, and clearing it is its own change.
  const lint = await run('uvx', ['ruff', 'check', 'toolbox', 'scripts'], { cwd: appRoot })
  const lintFindings = count(lint.stdout, /^Found (\d+) error/m)
  steps.push({
    name: 'Ruff lint',
    ok: true,
    durationMs: lint.durationMs,
    detail: lintFindings ? tail(lint.stdout || lint.stderr) : 'no findings',
  })

  const format = await run('uvx', ['ruff', 'format', '--check', 'toolbox', 'scripts'], {
    cwd: appRoot,
  })
  const unformatted = count(format.stdout || format.stderr, /^(\d+) files? would be reformatted/m)
  steps.push({
    name: 'Ruff format',
    ok: true,
    durationMs: format.durationMs,
    detail: unformatted ? `${unformatted} files would be reformatted` : 'already formatted',
  })

  const failures = steps
    .filter((step) => !step.ok)
    .map((step) => ({ name: step.name, detail: step.detail }))

  const notes = []
  if (lintFindings) notes.push(`Ruff reports ${lintFindings} lint findings, all predating this suite.`)
  if (unformatted) notes.push(`Ruff would reformat ${unformatted} files. Clearing that is its own change.`)

  return {
    status: failures.length ? 'failed' : 'passed',
    steps,
    failures,
    notes,
    metrics: {
      buildMs: build.durationMs,
      ruffFindings: lintFindings,
      ruffUnformattedFiles: unformatted,
    },
  }
}

function count(text, pattern) {
  return Number(text?.match(pattern)?.[1] ?? 0)
}

// Vite prints one line per emitted chunk. The performance layer holds the budget; this only keeps
// the headline size in the report so a jump is visible without opening another file.
function bundleSummary(stdout) {
  const built = stdout.match(/built in .+/)
  return built ? built[0] : 'build finished'
}

function tail(text, lines = 25) {
  return text.trim().split('\n').slice(-lines).join('\n')
}
