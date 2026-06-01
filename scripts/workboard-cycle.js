const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const WORKBOARD_DIR = path.join(ROOT, '.codex-temp', 'workboard')
const RUNS_DIR = path.join(WORKBOARD_DIR, 'runs')
const CURRENT_FILE = path.join(WORKBOARD_DIR, 'current.json')
const LOCK_FILE = path.join(WORKBOARD_DIR, 'workboard.lock')
const STALE_LOCK_MS = 30 * 60 * 1000
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000
const LONG_TIMEOUT_MS = 20 * 60 * 1000

const COMMANDS = Object.freeze({
  'check-fast-dry': {
    steps: [
      { command: 'node', args: ['scripts/run-fast-scope-checks.js', '--dry-run', '--json'] },
    ],
    description: 'Dry-run fast scope decision.',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  'check-fast': {
    steps: [
      { command: 'node', args: ['scripts/run-fast-scope-checks.js'] },
    ],
    description: 'Run fast scope checks.',
    timeoutMs: LONG_TIMEOUT_MS,
  },
  'check-preflight-dry': {
    steps: [
      { command: 'node', args: ['scripts/run-preflight-checks.js', '--dry-run'] },
    ],
    description: 'Dry-run preflight decision.',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  governance: {
    steps: [
      { command: 'node', args: ['scripts/guard-no-direct-linking-openurl.js'] },
      { command: 'node', args: ['scripts/guard-no-direct-window-open.js'] },
    ],
    description: 'Run local external-link guard checks without requiring npm.',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
})

const DEFAULT_DRY_COMMANDS = ['check-fast-dry']

function parseArgs(argv) {
  const out = {
    mode: 'cycle',
    commandIds: [],
    dryRun: true,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--heartbeat') {
      out.mode = 'heartbeat'
      out.dryRun = true
      continue
    }
    if (token === '--dry-run') {
      out.dryRun = true
      continue
    }
    if (token === '--run' && argv[i + 1]) {
      out.commandIds.push(String(argv[i + 1]).trim())
      out.dryRun = false
      i += 1
      continue
    }
    if (token === '--help') {
      out.help = true
      continue
    }
    throw new Error(`Unknown argument: ${token}`)
  }

  if (out.commandIds.length === 0) {
    out.commandIds = DEFAULT_DRY_COMMANDS
  }

  return out
}

function resolveCommand(command) {
  if (process.platform !== 'win32') return command
  if (command === 'npm') return 'npm.cmd'
  if (command === 'npx') return 'npx.cmd'
  return command
}

function run(command, args, options = {}) {
  return spawnSync(resolveCommand(command), args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 1024 * 1024 * 20,
    timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    ...options,
  })
}

function ensureRepoRoot() {
  if (!fs.existsSync(path.join(ROOT, 'package.json')) || !fs.existsSync(path.join(ROOT, 'AGENTS.md'))) {
    throw new Error(`workboard-cycle must run inside the metravel repo root: ${ROOT}`)
  }
}

function ensureMainBranch() {
  const result = run('git', ['branch', '--show-current'])
  const branch = String(result.stdout || '').trim()
  if (result.status !== 0) {
    throw new Error(`Unable to read current git branch: ${result.stderr || result.stdout}`)
  }
  if (branch !== 'main') {
    throw new Error(`Refusing to run workboard automation outside main. Current branch: ${branch || '(unknown)'}`)
  }
  return branch
}

function getGitStatusShort() {
  const result = run('git', ['status', '--short'])
  if (result.status !== 0) return []
  return String(result.stdout || '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
}

function ensureDirs() {
  fs.mkdirSync(RUNS_DIR, { recursive: true })
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readLock() {
  if (!fs.existsSync(LOCK_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'))
  } catch {
    return { parseError: true }
  }
}

function removeStaleLockIfNeeded() {
  const lock = readLock()
  if (!lock) return null

  const createdAtMs = Date.parse(lock.createdAt || '')
  const ageMs = Number.isFinite(createdAtMs) ? Date.now() - createdAtMs : Number.POSITIVE_INFINITY
  const stale = !isProcessAlive(Number(lock.pid)) || ageMs > STALE_LOCK_MS
  if (!stale) return lock

  try {
    fs.unlinkSync(LOCK_FILE)
  } catch {
    /* best-effort stale lock cleanup */
  }

  return null
}

function acquireLock() {
  ensureDirs()
  removeStaleLockIfNeeded()
  try {
    const fd = fs.openSync(LOCK_FILE, 'wx')
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }, null, 2))
    fs.closeSync(fd)
    return () => {
      try {
        fs.unlinkSync(LOCK_FILE)
      } catch {
        /* best-effort lock release */
      }
    }
  } catch {
    const details = fs.existsSync(LOCK_FILE) ? fs.readFileSync(LOCK_FILE, 'utf8') : ''
    throw new Error(`Another workboard cycle is already running. Lock: ${LOCK_FILE}\n${details}`)
  }
}

function redact(value) {
  return String(value || '')
    .replace(/(Authorization:\s*Bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/(token|secret|password|api[_-]?key)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/:\/\/([^:\s/@]+):([^@\s]+)@/g, '://[REDACTED]:[REDACTED]@')
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function createRunId(commandIds) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return `${stamp}-${commandIds.join('-')}`
}

function validateCommandIds(commandIds) {
  commandIds.forEach((id) => {
    if (!COMMANDS[id]) {
      throw new Error(`Unsupported workboard command id: ${id}. Allowed: ${Object.keys(COMMANDS).join(', ')}`)
    }
  })
}

function commandLine(step) {
  return [step.command, ...(step.args || [])].join(' ')
}

function runCommandSpec(id, spec) {
  const started = Date.now()
  const stepResults = []
  let exitCode = 0
  let stdout = ''
  let stderr = ''

  for (const step of spec.steps || []) {
    const result = run(step.command, step.args || [], { timeout: spec.timeoutMs || DEFAULT_TIMEOUT_MS })
    const timedOut = result.error && result.error.code === 'ETIMEDOUT'
    const stepExitCode = timedOut ? 124 : (result.status ?? 1)
    exitCode = stepExitCode
    stdout += redact(result.stdout)
    stderr += redact(result.stderr)
    if (timedOut) {
      stderr += `\nworkboard-cycle: command timed out after ${spec.timeoutMs || DEFAULT_TIMEOUT_MS}ms: ${commandLine(step)}\n`
    }
    stepResults.push({
      command: commandLine(step),
      exitCode: stepExitCode,
      status: stepExitCode === 0 ? 'passed' : 'failed',
    })
    if (stepExitCode !== 0) break
  }

  return {
    exitCode,
    status: exitCode === 0 ? 'passed' : 'failed',
    durationMs: Date.now() - started,
    stdout,
    stderr,
    steps: stepResults,
  }
}

function runCycle(args) {
  ensureRepoRoot()
  validateCommandIds(args.commandIds)
  const branch = ensureMainBranch()
  const releaseLock = acquireLock()
  const startedAt = new Date().toISOString()
  const runId = createRunId(args.commandIds)
  const runDir = path.join(RUNS_DIR, runId)
  fs.mkdirSync(runDir, { recursive: true })

  const commandResults = []
  let status = 'passed'

  try {
    const gitStatus = getGitStatusShort()
    writeJson(CURRENT_FILE, {
      schemaVersion: 1,
      updatedAt: startedAt,
      activeCycle: {
        runId,
        mode: args.mode,
        dryRun: args.dryRun,
        startedAt,
        branch,
        commands: args.commandIds,
      },
      lastRun: null,
    })

    for (const id of args.commandIds) {
      const spec = COMMANDS[id]
      const resolvedSpec = args.dryRun && id === 'check-fast' ? COMMANDS['check-fast-dry'] : spec
      const result = runCommandSpec(id, resolvedSpec)

      fs.writeFileSync(path.join(runDir, `${id}.stdout.log`), result.stdout, 'utf8')
      fs.writeFileSync(path.join(runDir, `${id}.stderr.log`), result.stderr, 'utf8')

      const commandResult = {
        id,
        command: (resolvedSpec.steps || []).map(commandLine).join(' && '),
        description: spec.description,
        status: result.status,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        steps: result.steps,
        stdoutLog: path.relative(ROOT, path.join(runDir, `${id}.stdout.log`)),
        stderrLog: path.relative(ROOT, path.join(runDir, `${id}.stderr.log`)),
      }
      commandResults.push(commandResult)
      if (commandResult.status !== 'passed') {
        status = 'failed'
        break
      }
    }

    const finishedAt = new Date().toISOString()
    const payload = {
      schemaVersion: 1,
      mode: args.mode,
      dryRun: args.dryRun,
      runId,
      status,
      startedAt,
      finishedAt,
      branch,
      worktreeDirty: gitStatus.length > 0,
      changedFiles: gitStatus,
      commands: commandResults,
      evidencePath: path.relative(ROOT, runDir),
      risks: [
        'Automation does not move tasks to Done automatically.',
        'Automation does not run deploy commands.',
        'Local HTML board remains a viewer until JSON source-of-truth generation is implemented.',
      ],
    }

    writeJson(path.join(runDir, 'run.json'), payload)
    writeJson(CURRENT_FILE, {
      schemaVersion: 1,
      updatedAt: finishedAt,
      activeCycle: null,
      lastRun: payload,
    })

    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
    return status === 'passed' ? 0 : 1
  } finally {
    releaseLock()
  }
}

function printHelp() {
  console.log(`Usage:
  node scripts/workboard-cycle.js --dry-run
  node scripts/workboard-cycle.js --heartbeat
  node scripts/workboard-cycle.js --run check-fast
  node scripts/workboard-cycle.js --run check-preflight-dry
  node scripts/workboard-cycle.js --run governance

Allowed command ids:
${Object.entries(COMMANDS).map(([id, spec]) => `  ${id}: ${spec.description}`).join('\n')}
`)
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2))
    if (args.help) {
      printHelp()
      return
    }
    process.exit(runCycle(args))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`workboard-cycle: ${redact(message)}`)
    process.exit(2)
  }
}

if (require.main === module) {
  main()
}
