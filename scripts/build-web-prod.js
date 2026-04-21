#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '..')
const envProdPath = path.join(repoRoot, '.env.prod')
const envPath = path.join(repoRoot, '.env')
const distProdPath = path.join(repoRoot, 'dist', 'prod')

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

fs.copyFileSync(envProdPath, envPath)
fs.rmSync(distProdPath, { recursive: true, force: true })

const buildEnv = {
  NODE_ENV: 'production',
  EXPO_ENV: 'prod',
  EXPO_PUBLIC_RNW_SLIM: '1',
  EXPO_WEB_BUILD_MINIFY: 'true',
  EXPO_WEB_BUILD_GENERATE_SOURCE_MAP: 'false',
}

runStep('node', ['scripts/build-web-safe.js', '-p', 'web', '-c'], buildEnv)
runStep('node', ['scripts/prepare-dist-prod.js'])
runStep('node', ['scripts/generate-seo-pages.js', '--dist', 'dist/prod'])
runStep('node', ['scripts/verify-static-travel-seo.js', '--dist', 'dist/prod'])
runStep('node', ['scripts/copy-public-files.js', 'dist/prod'])
runStep('node', ['scripts/add-cache-bust-meta.js', 'dist/prod'])
