'use strict'

// Shared cross-session web-build mutex.
//
// Both the prod orchestrator (build-web-prod.js) and the raw export wrapper
// (build-web-safe.js, used directly by `npm run build:web` AND spawned as a
// child by the prod build) acquire THIS SAME lock. That guarantees no two
// builds — in any agent session on this machine — run concurrently and clobber
// the shared `.env` / staging dir (the root cause of "prod deployed with the
// wrong config": a parallel dev build leaving dev env on disk mid-prod-build).
//
// Reentrancy: the prod build holds the lock and then spawns build-web-safe as a
// child. The child inherits MT_BUILD_LOCK_OWNED=1 via process.env and skips
// re-acquiring (which would otherwise self-deadlock).

const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const lockPath = path.join(repoRoot, 'dist', '.prod-build.lock')
const STALE_LOCK_MS = 90 * 60 * 1000

let lockOwned = false

function acquireBuildLock() {
  // A parent build already owns the lock; the child must not re-acquire it.
  if (process.env.MT_BUILD_LOCK_OWNED === '1') return

  fs.mkdirSync(path.dirname(lockPath), { recursive: true })

  if (fs.existsSync(lockPath)) {
    let info = {}
    try {
      info = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
    } catch {
      info = {}
    }
    const age = Date.now() - (Number(info.startedAt) || 0)
    if (age < STALE_LOCK_MS) {
      console.error(
        `ERROR: another web build is already running (pid ${info.pid || '?'}, ` +
          `started ${Math.round(age / 1000)}s ago). Refusing to start a concurrent build.\n` +
          `If you are sure no build is running, delete ${lockPath} and retry.`
      )
      process.exit(1)
    }
    console.warn(`WARN: removing stale build lock (age ${Math.round(age / 60000)}min): ${lockPath}`)
  }

  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: Date.now() }))
  lockOwned = true
  // Mark for child processes so they treat the lock as already held.
  process.env.MT_BUILD_LOCK_OWNED = '1'
}

function releaseBuildLock() {
  if (!lockOwned) return
  lockOwned = false
  try {
    fs.rmSync(lockPath, { force: true })
  } catch {
    // best-effort cleanup
  }
}

function registerBuildLockCleanup() {
  process.on('exit', releaseBuildLock)
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      releaseBuildLock()
      process.exit(130)
    })
  }
}

module.exports = {
  acquireBuildLock,
  releaseBuildLock,
  registerBuildLockCleanup,
  lockPath,
}
