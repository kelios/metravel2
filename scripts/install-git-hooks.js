const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = process.cwd()
const GIT_DIR = path.join(ROOT, '.git')
const HOOKS_DIR = path.join(ROOT, 'githooks')

const ensureGitRepository = () => {
  if (!fs.existsSync(GIT_DIR)) {
    throw new Error('Current directory is not a git repository root.')
  }
}

const ensureHooksDir = () => {
  if (!fs.existsSync(HOOKS_DIR)) {
    throw new Error('Expected tracked githooks/ directory is missing.')
  }
}

const runGit = (args) => {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
  })

  if ((result.status ?? 1) !== 0) {
    throw new Error(String(result.stderr || result.stdout || 'git command failed').trim())
  }
}

const main = () => {
  ensureGitRepository()
  ensureHooksDir()
  runGit(['config', 'core.hooksPath', 'githooks'])
  process.stdout.write('git hooks installed: core.hooksPath=githooks\n')
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`install-git-hooks: failed: ${String(error.message || error)}\n`)
    process.exit(1)
  }
}

module.exports = {
  ROOT,
  GIT_DIR,
  HOOKS_DIR,
  ensureGitRepository,
  ensureHooksDir,
}
