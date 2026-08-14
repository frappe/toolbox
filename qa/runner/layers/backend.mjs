import { run } from '../process.mjs'

export const id = 'backend'
export const name = 'Backend (Frappe)'
export const tier = 'full'

// `bench run-tests` writes unittest's own report and offers no machine-readable output, so the
// counts are parsed from it. Failures are kept whole rather than counted, because the name of the
// failing case is what a reader needs first.
export async function execute({ benchRoot, site }) {
  const result = await run('bench', ['--site', site, 'run-tests', '--app', 'toolbox'], {
    cwd: benchRoot,
  })

  // unittest writes its summary to stderr.
  const output = `${result.stderr}\n${result.stdout}`
  const ran = output.match(/Ran (\d+) tests? in ([\d.]+)s/)
  const counts = output.match(/failures=(\d+)|errors=(\d+)/g) || []

  const failures = result.ok
    ? []
    : parseFailures(output).map((name) => ({ name, detail: 'see backend.log' }))

  return {
    status: result.ok ? 'passed' : 'failed',
    metrics: {
      tests: ran ? Number(ran[1]) : null,
      seconds: ran ? Number(ran[2]) : null,
      problems: counts.length,
    },
    failures: failures.length || result.ok ? failures : [{ name: 'suite did not report', detail: tail(output) }],
    log: output,
  }
}

// unittest marks each one with a banner line: `FAIL: test_x (module.Class.test_x)`.
function parseFailures(output) {
  return [...output.matchAll(/^(?:FAIL|ERROR): (.+)$/gm)].map((match) => match[1].trim())
}

function tail(text, lines = 30) {
  return text.trim().split('\n').slice(-lines).join('\n')
}
