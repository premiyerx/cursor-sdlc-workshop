/**
 * Writes commit.sha before Vercel upload so remote builds (no .git) still stamp the footer with the real git SHA.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function findGitRoot(start) {
  let dir = start
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, '.git'))) return dir
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return start
}

const shaPath = resolve(appRoot, 'commit.sha')
const gitRoot = findGitRoot(appRoot)

try {
  const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8', cwd: gitRoot }).trim()
  writeFileSync(shaPath, `${sha}\n`, 'utf8')
  console.log(`commit.sha → ${sha}`)
  process.exit(0)
} catch {
  /* Vercel upload build: no .git — keep stamped file from deploy upload */
  if (existsSync(shaPath)) {
    const existing = readFileSync(shaPath, 'utf8').trim().slice(0, 7)
    if (existing && existing !== 'local') {
      console.log(`commit.sha kept (no git) → ${existing}`)
      process.exit(0)
    }
  }
  writeFileSync(shaPath, 'local\n', 'utf8')
  console.log('commit.sha → local')
}
