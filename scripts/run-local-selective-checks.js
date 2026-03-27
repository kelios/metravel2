const { spawnSync } = require('child_process')
const { readChangedFilesWithMeta } = require('./changed-files-utils')

const parseArgs = (argv) => {
  const out = {
    baseRef: '',
    changedFilesFile: '',
    dryRun: false,
    output: 'text',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--base-ref' && argv[i + 1]) {
      out.baseRef = String(argv[i + 1]).trim()
      i += 1
      continue
    }
    if (token === '--changed-files-file' && argv[i + 1]) {
      out.changedFilesFile = String(argv[i + 1]).trim()
      i += 1
      continue
    }
    if (token === '--dry-run') {
      out.dryRun = true
      continue
    }
    if (token === '--json') {
      out.output = 'json'
    }
  }

  return out
}

const normalizeFileList = (files) => {
  return [...new Set((files || []).map((file) => String(file || '').trim()).filter(Boolean))].sort()
}

const runGit = (args) => {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  return {
    status: result.status ?? 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  }
}

const ensureGitOk = (result, label) => {
  if (result.status !== 0) {
    throw new Error(`${label} failed: ${result.stderr || result.stdout}`)
  }
}

const parseLineList = (raw) => {
  return String(raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const collectWorkingTreeChangedFiles = () => {
  const staged = runGit(['diff', '--name-only', '--cached'])
  ensureGitOk(staged, 'git diff --cached')

  const unstaged = runGit(['diff', '--name-only'])
  ensureGitOk(unstaged, 'git diff')

  const untracked = runGit(['ls-files', '--others', '--exclude-standard'])
  ensureGitOk(untracked, 'git ls-files --others --exclude-standard')

  return normalizeFileList([
    ...parseLineList(staged.stdout),
    ...parseLineList(unstaged.stdout),
    ...parseLineList(untracked.stdout),
  ])
}

const collectBaseRefChangedFiles = (baseRef) => {
  const ref = String(baseRef || '').trim()
  if (!ref) {
    throw new Error('base ref is required')
  }

  const mergeBase = runGit(['merge-base', 'HEAD', ref])
  ensureGitOk(mergeBase, 'git merge-base')
  const baseSha = String(mergeBase.stdout || '').trim()
  if (!baseSha) {
    throw new Error(`git merge-base returned empty result for ${ref}`)
  }

  const diff = runGit(['diff', '--name-only', `${baseSha}...HEAD`])
  ensureGitOk(diff, 'git diff base...HEAD')
  return normalizeFileList(parseLineList(diff.stdout))
}

const resolveChangedFilesInput = ({ baseRef = '', changedFilesFile = '' } = {}) => {
  if (changedFilesFile) {
    const meta = readChangedFilesWithMeta({ changedFilesFile })
    return {
      files: normalizeFileList(meta.files),
      source: meta.source,
    }
  }

  if (baseRef) {
    return {
      files: collectBaseRefChangedFiles(baseRef),
      source: 'base-ref',
    }
  }

  return {
    files: collectWorkingTreeChangedFiles(),
    source: 'working-tree',
  }
}

const runSelectiveScript = ({ scriptPath, changedFiles, dryRun, output }) => {
  const args = [scriptPath]
  if (dryRun) args.push('--dry-run')
  if (output === 'json') args.push('--json')

  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      CHANGED_FILES: [...(changedFiles || []), ''].join('\n'),
    },
  })

  return {
    status: result.status ?? 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  }
}

const CHECKS = [
  {
    name: 'app-targeted-tests',
    scriptPath: 'scripts/run-app-contract-tests-if-needed.js',
  },
  {
    name: 'schema-contract-checks',
    scriptPath: 'scripts/run-schema-contract-tests-if-needed.js',
  },
  {
    name: 'validator-contract-checks',
    scriptPath: 'scripts/run-validator-contract-tests-if-needed.js',
  },
]

const runSelectiveChecks = ({ changedFiles, dryRun, output }) => {
  return CHECKS.map((check) => ({
    ...check,
    result: runSelectiveScript({
      scriptPath: check.scriptPath,
      changedFiles,
      dryRun,
      output,
    }),
  }))
}

const emitTextSummary = ({ source, changedFiles, checks }) => {
  console.log(`local-selective-checks: source=${source}, changed-files=${changedFiles.length}`)
  if (changedFiles.length > 0) {
    console.log(`local-selective-checks: files=${changedFiles.join(', ')}`)
  }

  for (const check of checks) {
    if (check.result.stdout.trim()) {
      process.stdout.write(check.result.stdout)
      if (!check.result.stdout.endsWith('\n')) process.stdout.write('\n')
    }
    if (check.result.stderr.trim()) {
      process.stderr.write(check.result.stderr)
      if (!check.result.stderr.endsWith('\n')) process.stderr.write('\n')
    }
  }
}

const emitJsonSummary = ({ source, changedFiles, checks }) => {
  const payload = {
    contractVersion: 1,
    source,
    changedFilesScanned: changedFiles.length,
    changedFiles,
    checks: checks.map((check) => JSON.parse(check.result.stdout)),
  }
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    if (args.output === 'json' && !args.dryRun) {
      console.error('local-selective-checks: --json is supported only with --dry-run.')
      process.exit(2)
    }

    const input = resolveChangedFilesInput(args)
    const checks = runSelectiveChecks({
      changedFiles: input.files,
      dryRun: args.dryRun,
      output: args.output,
    })

    const failed = checks.find((check) => check.result.status !== 0)
    if (failed) {
      if (failed.result.stdout.trim()) process.stdout.write(failed.result.stdout)
      if (failed.result.stderr.trim()) process.stderr.write(failed.result.stderr)
      process.exit(failed.result.status)
    }

    if (args.output === 'json') {
      emitJsonSummary({
        source: input.source,
        changedFiles: input.files,
        checks,
      })
      return
    }

    emitTextSummary({
      source: input.source,
      changedFiles: input.files,
      checks,
    })
  } catch (error) {
    console.error(`local-selective-checks: failed: ${String(error.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  CHECKS,
  parseArgs,
  normalizeFileList,
  parseLineList,
  collectWorkingTreeChangedFiles,
  collectBaseRefChangedFiles,
  resolveChangedFilesInput,
  runSelectiveChecks,
}
