import { join } from 'node:path'

import { readJson, run } from '../process.mjs'

export const id = 'units'
export const name = 'Frontend units'
export const tier = 'fast'

export async function execute({ appRoot, reportDir }) {
  const resultsPath = join(reportDir, 'vitest.json')
  const coverageDir = join(reportDir, 'coverage')

  const result = await run(
    'yarn',
    [
      '--cwd',
      'frontend',
      'vitest',
      'run',
      '--reporter=default',
      '--reporter=json',
      `--outputFile.json=${resultsPath}`,
      '--coverage',
      '--coverage.reporter=json-summary',
      '--coverage.reporter=html',
      `--coverage.reportsDirectory=${coverageDir}`,
    ],
    { cwd: appRoot },
  )

  const report = await readJson(resultsPath)
  const coverage = await readJson(join(coverageDir, 'coverage-summary.json'))

  const failures = (report?.testResults || [])
    .flatMap((file) => file.assertionResults.map((test) => ({ file: file.name, test })))
    .filter(({ test }) => test.status === 'failed')
    .map(({ file, test }) => ({
      name: `${relative(file, appRoot)} › ${test.fullName}`,
      detail: (test.failureMessages || []).join('\n').slice(0, 2000),
    }))

  return {
    status: result.ok && failures.length === 0 ? 'passed' : 'failed',
    metrics: {
      tests: report?.numTotalTests ?? null,
      // `numTotalTestSuites` counts describe blocks, not files.
      files: report?.testResults?.length ?? null,
      failed: report?.numFailedTests ?? failures.length,
      lineCoverage: coverage?.total?.lines?.pct ?? null,
    },
    failures,
    artifacts: { coverage: join(coverageDir, 'index.html') },
  }
}

function relative(path, root) {
  return path.startsWith(root) ? path.slice(root.length + 1) : path
}
