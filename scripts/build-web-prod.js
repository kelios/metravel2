#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '..')
const envProdPath = path.join(repoRoot, '.env.prod')
const envPath = path.join(repoRoot, '.env')
const distProdPath = path.join(repoRoot, 'dist', 'prod')
// Build into a staging dir and swap into dist/prod only after every step
// succeeds. This keeps the previous good build intact on failure — a crashed
// SEO/verify/cache-bust step must never leave dist/prod half-written.
const stagingPath = path.join(repoRoot, 'dist', '.prod-staging')
const exportPath = path.join(repoRoot, '.tmp', 'prod-web-export')

function parseEnvFile(filePath) {
  const vars = {}
  if (!fs.existsSync(filePath)) return vars
  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) vars[key] = value
  }
  return vars
}

const lockPath = path.join(repoRoot, 'dist', '.prod-build.lock')
const STALE_LOCK_MS = 90 * 60 * 1000
let lockOwned = false

function acquireBuildLock() {
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
        `ERROR: another prod web build is already running (pid ${info.pid || '?'}, ` +
          `started ${Math.round(age / 1000)}s ago). Refusing to start a concurrent build.\n` +
          `If you are sure no build is running, delete ${lockPath} and retry.`
      )
      process.exit(1)
    }
    console.warn(`WARN: removing stale build lock (age ${Math.round(age / 60000)}min): ${lockPath}`)
  }
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: Date.now() }))
  lockOwned = true
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

process.on('exit', releaseBuildLock)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    releaseBuildLock()
    process.exit(130)
  })
}

function runStep(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      ...extraEnv,
    },
  })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

function swapIntoPlace(from, to) {
  fs.rmSync(to, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(to), { recursive: true })
  try {
    fs.renameSync(from, to)
  } catch (error) {
    // Windows can reject cross-handle renames (EPERM/EBUSY/ENOTEMPTY); fall
    // back to copy + remove so the swap still completes atomically enough.
    const recoverable = new Set(['EPERM', 'EBUSY', 'EXDEV', 'ENOTEMPTY', 'EACCES'])
    if (process.platform !== 'win32' && !recoverable.has(error && error.code)) {
      throw error
    }
    fs.cpSync(from, to, { recursive: true, force: true })
    fs.rmSync(from, { recursive: true, force: true })
  }
}

// Serialize prod builds: a concurrent build would corrupt the shared staging
// dir and the .env copy below. The lock is released on any process exit.
acquireBuildLock()

fs.copyFileSync(envProdPath, envPath)
// Do NOT touch dist/prod here — the last good build stays in place until the
// new build is fully assembled in staging.
fs.rmSync(stagingPath, { recursive: true, force: true })
fs.rmSync(exportPath, { recursive: true, force: true })

// Make .env.prod authoritative for the prod bundle. Expo loads `.env.local`
// (a gitignored dev override) with HIGHER priority than `.env`, so a developer's
// local API URL (e.g. a LAN IP like http://192.168.50.36) would otherwise be
// baked into the prod build and break login/API for all users. Values present
// in process.env win over every dotenv file, so injecting the parsed .env.prod
// vars into the build env closes that hole.
const prodEnvVars = parseEnvFile(envProdPath)

const buildEnv = {
  ...prodEnvVars,
  NODE_ENV: 'production',
  EXPO_ENV: 'prod',
  EXPO_PUBLIC_RNW_SLIM: '1',
  EXPO_WEB_BUILD_MINIFY: 'true',
  EXPO_WEB_BUILD_GENERATE_SOURCE_MAP: 'false',
}

runStep('node', ['scripts/build-web-safe.js', '-p', 'web', '-c', '--output-dir', exportPath], buildEnv)
runStep('node', ['scripts/prepare-dist-prod.js', '--src', exportPath, '--dest', stagingPath])
runStep('node', ['scripts/generate-seo-pages.js', '--dist', stagingPath])
runStep('node', ['scripts/verify-static-travel-seo.js', '--dist', stagingPath])
runStep('node', ['scripts/copy-public-files.js', stagingPath])
runStep('node', ['scripts/add-cache-bust-meta.js', stagingPath])

// All steps succeeded — atomically replace the previous build.
swapIntoPlace(stagingPath, distProdPath)
fs.rmSync(exportPath, { recursive: true, force: true })
