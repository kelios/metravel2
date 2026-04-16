const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const { resolveChangedFilesInput } = require('./run-local-selective-checks')

const CHECKS = [
  {
    name: 'fast-scope-checks',
    scriptPath: 'scripts/run-fast-scope-checks.js',
  },
  {
    name: 'guard-file-complexity-changed',
    scriptPath: 'scripts/guard-file-complexity-changed.js',
  },
  {
    name: 'e2e-changed',
    scriptPath: 'scripts/run-e2e-changed.js',
  },
]

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

const createChangedFilesTempInput = (changedFiles) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-checks-'))
  const filePath = path.join(dir, 'changed-files.txt')
  fs.writeFileSync(filePath, [...(changedFiles || []), ''].join('\n'), 'utf8')

  return {
    dir,
    filePath,
  }
}

const removeTempInput = (tempInput) => {
  if (!tempInput?.dir) return
  fs.rmSync(tempInput.dir, { recursive: true, force: true })
}

const buildRunnerArgs = ({ scriptPath, changedFilesFile, dryRun, output }) => {
  const args = [scriptPath, '--changed-files-file', changedFilesFile]
  if (dryRun) args.push('--dry-run')
  if (output === 'json') args.push('--json')
  return args
}

const runCheck = ({ scriptPath, changedFilesFile, dryRun, output }) => {
  const result = spawnSync(process.execPath, buildRunnerArgs({ scriptPath, changedFilesFile, dryRun, output }), {
    encoding: 'utf8',
    stdio: output === 'json' ? 'pipe' : 'inherit',
  })

  return {
    status: result.status ?? 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  }
}

const emitJsonSummary = ({ source, changedFiles, checks }) => {
  const payload = {
    contractVersion: 1,
    check: 'preflight-checks',
    source,
    changedFilesScanned: changedFiles.length,
    changedFiles,
    checks: checks.map((check) => ({
      name: check.name,
      payload: JSON.parse(check.result.stdout),
    })),
  }

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

const main = () => {
  let tempInput = null

  try {
    const args = parseArgs(process.argv.slice(2))
    if (args.output === 'json' && !args.dryRun) {
      console.error('preflight-checks: --json is supported only with --dry-run.')
      process.exit(2)
    }

    const input = resolveChangedFilesInput(args)
    tempInput = createChangedFilesTempInput(input.files)

    if (args.output !== 'json') {
      console.log(`preflight-checks: source=${input.source}, changed-files=${input.files.length}`)
      if (input.files.length > 0) {
        console.log(`preflight-checks: files=${input.files.join(', ')}`)
      }
    }

    const checks = CHECKS.map((check) => ({
      ...check,
      result: runCheck({
        scriptPath: check.scriptPath,
        changedFilesFile: tempInput.filePath,
        dryRun: args.dryRun,
        output: args.output,
      }),
    }))

    const failed = checks.find((check) => check.result.status !== 0)
    if (failed) {
      if (args.output === 'json') {
        if (failed.result.stdout.trim()) process.stdout.write(failed.result.stdout)
        if (failed.result.stderr.trim()) process.stderr.write(failed.result.stderr)
      }
      process.exit(failed.result.status)
    }

    if (args.output === 'json') {
      emitJsonSummary({
        source: input.source,
        changedFiles: input.files,
        checks,
      })
    }
  } catch (error) {
    console.error(`preflight-checks: failed: ${String(error.message || error)}`)
    process.exit(1)
  } finally {
    removeTempInput(tempInput)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  CHECKS,
  parseArgs,
  createChangedFilesTempInput,
  removeTempInput,
  buildRunnerArgs,
}

