import { run } from '../process.mjs'

export const id = 'static'
export const name = 'Static gates'
export const tier = 'fast'

// Pinned on purpose. See the note above the ruff steps below.
const RUFF = 'ruff@0.16.3'

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

  // Ruff was a ratchet rather than a gate, because the repository carried 12 findings and 20
  // unformatted files that predated this suite, and clearing them inside somebody's change would
  // have buried it. That debt is gone, so this is a gate now: any finding fails the run. The two
  // counts are still recorded, so `baseline.json` catches a rise even if this gate is loosened.
  //
  // The version is pinned. `uvx ruff` resolves to whatever is newest, so a ruff release could move
  // these numbers with no change to the code — which is the one thing a ratchet must not do.
  // `.pre-commit-config.yaml` pins v0.14.10 and both agree the tree is clean, but the two are not
  // the same set: the older formatter walks 74 files here where this one walks 110.
  const lint = await run('uvx', [RUFF, 'check', 'toolbox', 'scripts'], { cwd: appRoot })
  const lintFindings = count(lint.stdout, /^Found (\d+) error/m)
  steps.push({
    name: 'Ruff lint',
    ok: lintFindings === 0,
    durationMs: lint.durationMs,
    detail: lintFindings ? tail(lint.stdout || lint.stderr) : 'no findings',
  })

  const format = await run('uvx', [RUFF, 'format', '--check', 'toolbox', 'scripts'], {
    cwd: appRoot,
  })
  const unformatted = count(format.stdout || format.stderr, /^(\d+) files? would be reformatted/m)
  steps.push({
    name: 'Ruff format',
    ok: unformatted === 0,
    durationMs: format.durationMs,
    detail: unformatted ? `${unformatted} files would be reformatted` : 'already formatted',
  })

  const failures = steps
    .filter((step) => !step.ok)
    .map((step) => ({ name: step.name, detail: step.detail }))

  const notes = []
  if (lintFindings) notes.push(`Ruff reports ${lintFindings} lint findings. Run \`uvx ${RUFF} check --fix toolbox scripts\`.`)
  if (unformatted) notes.push(`Ruff would reformat ${unformatted} files. Run \`uvx ${RUFF} format toolbox scripts\`.`)

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
