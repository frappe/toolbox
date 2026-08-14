import { spawn } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'

// Every layer shells out. One helper does it, so a layer describes what it runs and reads the
// result, and nothing has to remember to capture stderr or to time itself.
export async function run(command, args, options = {}) {
  const startedAt = Date.now()
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk
    if (options.echo) process.stdout.write(chunk)
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk
    if (options.echo) process.stderr.write(chunk)
  })

  const code = await new Promise((resolve) => {
    // A command that is not installed rejects rather than exiting, and a layer wants the same
    // shape either way.
    child.on('error', (error) => {
      stderr += `${error.message}\n`
      resolve(error.code === 'ENOENT' ? 127 : 1)
    })
    child.on('close', resolve)
  })

  return { code, stdout, stderr, durationMs: Date.now() - startedAt, ok: code === 0 }
}

// A missing report file means the command died before it wrote one. That is a layer failure, not
// a crash of the runner, so the caller gets null and reports it in its own words.
export async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

export async function ensureDir(path) {
  await mkdir(path, { recursive: true })
}

export async function ensureParent(path) {
  await ensureDir(dirname(path))
}

export function has(binary) {
  return run('sh', ['-c', `command -v ${binary}`]).then((result) => result.ok)
}
