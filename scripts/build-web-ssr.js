#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawn, execFileSync } = require('node:child_process')
const { resolveWebOutput } = require('./lib/webOutput')

const repoRoot = path.resolve(__dirname, '..')

function getOutputDir(args = process.argv.slice(2)) {
  if (args.length && (args.length !== 2 || args[0] !== '--output-dir' || !args[1])) {
    throw new Error('Usage: node scripts/build-web-ssr.js [--output-dir .codex-temp/<directory>]')
  }
  const outputDir = path.resolve(repoRoot, args[1] || '.codex-temp/ssr-2766')
  const scratchRoot = path.join(repoRoot, '.codex-temp')
  const relative = path.relative(scratchRoot, outputDir)
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('SSR build output must be a directory inside .codex-temp')
  }
  // Validate existing ancestors as well: an ignored symlink must not redirect
  // the exporter into the production artifact or outside the scratch tree.
  let ancestor = outputDir
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor)
  const realScratch = path.join(fs.realpathSync(repoRoot), '.codex-temp')
  const realRelative = path.relative(realScratch, fs.realpathSync(ancestor))
  if (ancestor !== repoRoot && (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative))) {
    throw new Error('SSR output directory follows a symlink outside .codex-temp')
  }
  return outputDir
}

function main() {
  require('./ensure-node-version').assertSupportedNode()
  const outputDir = getOutputDir()
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    EXPO_NO_DOTENV: '1',
    METRAVEL_WEB_OUTPUT: 'server',
    EXPO_PUBLIC_WEB_RUNTIME_SSR: 'true',
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
    EXPO_PUBLIC_RNW_SLIM: '1',
    EXPO_WEB_BUILD_MINIFY: 'true',
    EXPO_WEB_BUILD_GENERATE_SOURCE_MAP: 'false',
  }
  resolveWebOutput(env)
  const { acquireBuildLock, releaseBuildLock } = require('./build-lock')
  acquireBuildLock()
  process.once('exit', releaseBuildLock)
  env.MT_BUILD_LOCK_OWNED = process.env.MT_BUILD_LOCK_OWNED
  const child = spawn(process.execPath, [
    'scripts/build-web-safe.js', '-p', 'web', '-c', '--output-dir', outputDir,
  ], { cwd: repoRoot, env, stdio: 'inherit' })
  let interrupted = false
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      interrupted = true
      child.kill(signal)
    })
  }
  child.once('error', (error) => {
    console.error(`[build-web-ssr] ${error.message}`)
    process.exitCode = 1
  })
  child.once('exit', (code) => {
    if (interrupted || code !== 0) {
      process.exitCode = typeof code === 'number' && code !== 0 ? code : 1
      return
    }
    const { assertServerExport } = require('./build-web-safe')
    try {
      assertServerExport(outputDir)
      const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
      const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim())
      fs.writeFileSync(path.join(outputDir, '.ssr-build.json'), JSON.stringify({ sha, dirty, output: 'server' }) + '\n')
      console.log(`[build-web-ssr] Ready: ${outputDir}`)
    } catch (error) {
      console.error(`[build-web-ssr] ${error.message}`)
      process.exitCode = 1
    }
  })
}

module.exports = { getOutputDir, main }
if (require.main === module) main()
