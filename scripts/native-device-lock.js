'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { createHash, randomUUID } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { resolveLockRoot } = require('./build-lock')
const { isProcessAlive } = require('./quality-gate-lock')

function findConflictingNativeProcesses(device, raw, currentPid = process.pid) {
  const rows = require('./quality-gate-lock').parseProcessTable(raw)
  const ancestors = new Set([currentPid])
  let parent = rows.find((row) => row.pid === currentPid)?.ppid
  while (parent && !ancestors.has(parent)) {
    ancestors.add(parent)
    parent = rows.find((row) => row.pid === parent)?.ppid
  }
  return rows.filter((row) => !ancestors.has(row.pid) && row.command.includes(device) && /\b(?:maestro|xcodebuild|simctl|devicectl)\b/.test(row.command))
}

// Shared by Maestro and physical XCTest. Device identifiers never enter reports.
function acquireDeviceLock({ device, root = resolveLockRoot(), name = 'native-e2e' }) {
  if (typeof device !== 'string' || !device.trim()) throw new Error('An explicit device is required')
  const key = createHash('sha256').update(device).digest('hex').slice(0, 20)
  const lockPath = path.join(root, '.codex-temp', 'ops', `native-device-${key}.lock`)
  fs.mkdirSync(path.dirname(lockPath), { recursive: true })
  const token = randomUUID()
  try {
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, token, name, startedAt: new Date().toISOString() }), { flag: 'wx' })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    let owner
    try { owner = JSON.parse(fs.readFileSync(lockPath, 'utf8')) } catch { /* Fail closed during owner creation. */ }
    const busy = new Error(`Native device is reserved (pid=${owner?.pid || '?'}, name=${owner?.name || '?'}). ${owner?.pid && !isProcessAlive(owner.pid) ? `Dead owner: verify no device operation remains, then remove ${lockPath}.` : 'Do not wait or retry.'}`)
    busy.code = 'NATIVE_DEVICE_BUSY'
    throw busy
  }
  const release = () => {
    try {
      const owner = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
      if (owner.token === token) fs.unlinkSync(lockPath)
    } catch { /* A missing or replaced lock is never ours to delete. */ }
  }
  // Legacy/direct tools may not yet use this lock. Refuse their live target.
  try {
    const raw = execFileSync('ps', ['-ax', '-o', 'pid=,ppid=,command='], { encoding: 'utf8', timeout: 5000 })
    const conflicts = findConflictingNativeProcesses(device, raw)
    if (conflicts.length) {
      const busy = new Error(`Native device operation already active (pid=${conflicts.map((row) => row.pid).join(',')}); do not wait or retry`)
      busy.code = 'NATIVE_DEVICE_BUSY'
      throw busy
    }
  } catch (error) {
    release()
    throw error
  }
  return release
}

module.exports = { acquireDeviceLock, findConflictingNativeProcesses }
