#!/usr/bin/env node

'use strict'

const fs = require('node:fs')
const path = require('node:path')

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

function assertSupportedNode(currentVersion = process.version) {
  const current = parseVersion(currentVersion)
  const minimum = parseVersion(minimumVersion)

  if (!current || !minimum || current.major !== requiredMajor || compareVersions(current, minimum) < 0) {
    const pinned = readPinnedVersion()
    const message = [
      `Unsupported Node.js ${currentVersion}.`,
      `Metravel requires Node.js >=${minimumVersion} <23 (pinned: ${pinned}).`,
      'Run `nvm use` from the repository root or put Node 22 first in PATH.',
    ].join('\n')
    const error = new Error(message)
    error.code = 'ERR_UNSUPPORTED_NODE_VERSION'
    throw error
  }
}

if (require.main === module) {
  try {
    assertSupportedNode()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

module.exports = {
  assertSupportedNode,
}
