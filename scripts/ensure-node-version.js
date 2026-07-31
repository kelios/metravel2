#!/usr/bin/env node

'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const repoRoot = path.resolve(__dirname, '..')
const nodeVersionFile = path.join(repoRoot, '.node-version')
const minimumVersion = '22.13.1'
const requiredMajor = 22

function parseVersion(rawVersion) {
  const match = String(rawVersion || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

function compareVersions(left, right) {
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] > right[key]) return 1
    if (left[key] < right[key]) return -1
  }
  return 0
}

function readPinnedVersion() {
  try {
    const pinned = fs.readFileSync(nodeVersionFile, 'utf8').trim()
    return pinned || minimumVersion
  } catch {
    return minimumVersion
  }
}

function isSupportedVersion(rawVersion) {
  const parsed = parseVersion(rawVersion)
  const minimum = parseVersion(minimumVersion)
  if (!parsed || !minimum) return false
  return parsed.major === requiredMajor && compareVersions(parsed, minimum) >= 0
}

/**
 * Directories that may hold a second Node install, newest-looking first.
 * Covers the version managers people actually use plus Homebrew kegs, which is
 * how this workstation gets Node 22 while `node` on PATH is still Node 20.
 */
function candidateBinDirs(env = process.env, homeDir = os.homedir()) {
  const dirs = []

  const nvmDir = env.NVM_DIR || (homeDir ? path.join(homeDir, '.nvm') : '')
  if (nvmDir) dirs.push(...listSubdirBins(path.join(nvmDir, 'versions', 'node')))
  if (homeDir) {
    dirs.push(...listSubdirBins(path.join(homeDir, '.local', 'share', 'fnm', 'node-versions')))
    dirs.push(path.join(homeDir, '.volta', 'bin'))
    dirs.push(...listSubdirBins(path.join(homeDir, '.asdf', 'installs', 'nodejs')))
  }
  for (const prefix of ['/opt/homebrew/opt', '/usr/local/opt']) {
    dirs.push(...listMatchingBins(prefix, /^node(@\d+)?$/))
  }

  return dirs.filter((dir, index) => dir && dirs.indexOf(dir) === index)
}

/** `<root>/<entry>/bin` for every entry of a version-manager root. */
function listSubdirBins(root) {
  return readDirSafe(root).map((entry) => path.join(root, entry, 'bin'))
}

/** `<prefix>/<entry>/bin` for entries matching a pattern (Homebrew kegs). */
function listMatchingBins(prefix, pattern) {
  return readDirSafe(prefix)
    .filter((entry) => pattern.test(entry))
    .map((entry) => path.join(prefix, entry, 'bin'))
}

function readDirSafe(dir) {
  try {
    return fs.readdirSync(dir).sort().reverse()
  } catch {
    return []
  }
}

/** Actual `node -v` of a binary, or null when it is missing/unreadable. */
function probeNodeVersion(binDir, exec = execFileSync) {
  const binary = path.join(binDir, process.platform === 'win32' ? 'node.exe' : 'node')
  try {
    if (!fs.existsSync(binary)) return null
    return String(exec(binary, ['-v'], { encoding: 'utf8', timeout: 5000 })).trim()
  } catch {
    return null
  }
}

/**
 * First locally installed Node that actually satisfies the range, verified by
 * running it — never inferred from a directory name.
 */
function findSupportedNodeHint(options = {}) {
  const { env = process.env, homeDir = os.homedir(), exec = execFileSync } = options
  try {
    for (const binDir of candidateBinDirs(env, homeDir)) {
      const version = probeNodeVersion(binDir, exec)
      if (version && isSupportedVersion(version)) return { version, binDir }
    }
  } catch {
    return null
  }
  return null
}

function buildUnsupportedMessage(currentVersion, hint) {
  const pinned = readPinnedVersion()
  const lines = [
    `Unsupported Node.js ${currentVersion}.`,
    `Metravel requires Node.js >=${minimumVersion} <23 (pinned: ${pinned}).`,
  ]
  if (hint) {
    lines.push(
      `Found Node ${hint.version} at ${hint.binDir}`,
      `Run: export PATH="${hint.binDir}:$PATH"`,
    )
  } else {
    lines.push('Run `nvm use` from the repository root or put Node 22 first in PATH.')
  }
  return lines.join('\n')
}

function assertSupportedNode(currentVersion = process.version, options = {}) {
  if (isSupportedVersion(currentVersion)) return

  const error = new Error(buildUnsupportedMessage(currentVersion, findSupportedNodeHint(options)))
  error.code = 'ERR_UNSUPPORTED_NODE_VERSION'
  throw error
}

if (require.main === module) {
  // `--print-bin-dir` печатает каталог подходящего Node и молчит обо всём
  // остальном, чтобы шелл-скрипты могли подставить его в PATH:
  //
  //     export PATH="$(node scripts/ensure-node-version.js --print-bin-dir):$PATH"
  //
  // Нужен, потому что сообщение об ошибке рассчитано на человека, а
  // `scripts/use-node.sh` должен получить один путь без лишнего текста.
  // Поиск при этом тот же самый — версия проверяется реальным `node -v`.
  if (process.argv.includes('--print-bin-dir')) {
    const hint = isSupportedVersion(process.version)
      ? { binDir: path.dirname(process.execPath) }
      : findSupportedNodeHint()
    if (!hint) process.exit(1)
    process.stdout.write(hint.binDir)
    process.exit(0)
  }

  try {
    assertSupportedNode()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

module.exports = {
  assertSupportedNode,
  buildUnsupportedMessage,
  candidateBinDirs,
  findSupportedNodeHint,
  isSupportedVersion,
}
