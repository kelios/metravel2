'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const repoRoot = path.resolve(__dirname, '..')
const defaultLockPath = path.join(repoRoot, '.codex-temp', 'ops', 'quality-gate.lock')
const ownerFileName = 'owner.json'
const MALFORMED_LOCK_STALE_MS = 90 * 60 * 1000

const QUALITY_PROCESS_PATTERNS = [
  /node_modules[\\/](?:\.bin[\\/])?jest(?:\s|$|[\\/])/i,
  /playwright[\\/]cli\.js\s+test(?:\s|$)/i,
  /scripts[\\/]e2e-run\.js(?:\s|$)/i,
  /scripts[\\/]run-preflight-checks\.js(?:\s|$)/i,
  /scripts[\\/]run-fast-scope-checks\.js(?:\s|$)/i,
  /(?:npm|yarn)\s+(?:run\s+)?(?:release:check|test:run|e2e|check:preflight)(?:\s|$)/i,
]

let ownedLockPath = null

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}

function parseProcessTable(raw) {
  return String(raw || '')
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)
      if (!match) return null
      return { pid: Number(match[1]), ppid: Number(match[2]), command: match[3].trim() }
    })
    .filter(Boolean)
}

function listProcesses() {
  try {
    return parseProcessTable(
      execFileSync('ps', ['-ax', '-o', 'pid=,ppid=,command='], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    )
  } catch {
    // The atomic lock still protects all project-owned wrappers on platforms
    // without `ps`; raw-process discovery is a best-effort compatibility layer.
    return []
  }
}

function readProcessCwd(pid) {
  try {
    const output = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const cwdLine = String(output).split(/\r?\n/).find((line) => line.startsWith('n'))
    return cwdLine ? path.resolve(cwdLine.slice(1)) : ''
  } catch {
    return ''
  }
}

function getAncestorPids(rows, pid = process.pid) {
  const byPid = new Map(rows.map((row) => [row.pid, row]))
  const ancestors = new Set([pid])
  let current = byPid.get(pid)
  while (current && current.ppid > 0 && !ancestors.has(current.ppid)) {
    ancestors.add(current.ppid)
    current = byPid.get(current.ppid)
  }
  return ancestors
}

function findConflictingQualityProcesses({
  rows = listProcesses(),
  root = repoRoot,
  currentPid = process.pid,
  getCwd = readProcessCwd,
} = {}) {
  const resolvedRoot = path.resolve(root)
  const ancestors = getAncestorPids(rows, currentPid)

  return rows.filter((row) => {
    if (ancestors.has(row.pid)) return false
    if (!QUALITY_PROCESS_PATTERNS.some((pattern) => pattern.test(row.command))) return false
    if (row.command.includes(resolvedRoot)) return true
    return getCwd(row.pid) === resolvedRoot
  })
}

function readOwner(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(lockPath, ownerFileName), 'utf8'))
  } catch {
    return null
  }
}

function removeLock(lockPath) {
  fs.rmSync(lockPath, { recursive: true, force: true })
}

function releaseQualityGateLock() {
  if (!ownedLockPath) return
  const lockPath = ownedLockPath
  ownedLockPath = null
  try {
    const owner = readOwner(lockPath)
    if (!owner || Number(owner.pid) === process.pid) removeLock(lockPath)
  } catch {
    // best-effort cleanup; a following run can recover a dead-owner lock
  }
  delete process.env.MT_QUALITY_GATE_LOCK_OWNED
}

function acquireQualityGateLock({
  name = 'quality-gate',
  lockPath = defaultLockPath,
  detectProcesses = true,
} = {}) {
  if (process.env.MT_QUALITY_GATE_LOCK_OWNED === '1') return { reentrant: true }

  fs.mkdirSync(path.dirname(lockPath), { recursive: true })

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      fs.mkdirSync(lockPath)
      break
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      const owner = readOwner(lockPath)
      const lockStat = fs.statSync(lockPath)
      const malformedAge = Date.now() - lockStat.mtimeMs
      const ownerPid = Number(owner?.pid)
      const stale = ownerPid > 0 ? !isProcessAlive(ownerPid) : malformedAge > MALFORMED_LOCK_STALE_MS
      if (!stale) {
        const started = owner?.startedAt ? new Date(owner.startedAt).toISOString() : 'unknown'
        throw new Error(
          `another quality gate is already running` +
            ` (pid=${ownerPid || '?'}, name=${owner?.name || 'unknown'}, started=${started})`
        )
      }
      console.warn(`quality-gate-lock: removing stale lock ${lockPath}`)
      removeLock(lockPath)
      if (attempt === 1) throw new Error(`could not recover stale lock ${lockPath}`)
    }
  }

  fs.writeFileSync(
    path.join(lockPath, ownerFileName),
    JSON.stringify({ pid: process.pid, name, startedAt: Date.now(), cwd: repoRoot }, null, 2)
  )
  ownedLockPath = lockPath
  process.env.MT_QUALITY_GATE_LOCK_OWNED = '1'

  if (detectProcesses) {
    const conflicts = findConflictingQualityProcesses()
    if (conflicts.length > 0) {
      releaseQualityGateLock()
      const summary = conflicts
        .slice(0, 5)
        .map((row) => `pid=${row.pid} command=${row.command}`)
        .join('\n')
      throw new Error(`quality test process already exists in this workspace:\n${summary}`)
    }
  }

  return { reentrant: false, lockPath }
}

module.exports = {
  QUALITY_PROCESS_PATTERNS,
  acquireQualityGateLock,
  defaultLockPath,
  findConflictingQualityProcesses,
  isProcessAlive,
  parseProcessTable,
  releaseQualityGateLock,
}
