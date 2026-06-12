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

fs.copyFileSync(envProdPath, envPath)
// Do NOT touch dist/prod here — the last good build stays in place until the
// new build is fully assembled in staging.
fs.rmSync(stagingPath, { recursive: true, force: true })
fs.rmSync(exportPath, { recursive: true, force: true })

const buildEnv = {
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
