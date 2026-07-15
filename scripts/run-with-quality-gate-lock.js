#!/usr/bin/env node

'use strict'

const { spawn } = require('node:child_process')
const {
  acquireQualityGateLock,
  formatQualityGateSkipMessage,
  isQualityGateBusyError,
  releaseQualityGateLock,
} = require('./quality-gate-lock')

const argv = process.argv.slice(2)
const separatorIndex = argv.indexOf('--')
const shellIndex = argv.indexOf('--shell')
const name = String(argv[0] || 'quality-gate')

let command = ''
let commandArgs = []
let useShell = false

if (shellIndex >= 0) {
  command = argv.slice(shellIndex + 1).join(' ')
  useShell = true
} else if (separatorIndex >= 0) {
  command = argv[separatorIndex + 1] || ''
  commandArgs = argv.slice(separatorIndex + 2)
}

if (!command) {
  console.error('quality-gate-lock: command is required after `--` or `--shell`.')
  process.exit(2)
}

try {
  const result = acquireQualityGateLock({ name })
  if (!result.reentrant) {
    console.log(`quality-gate-lock: acquired for ${name} (pid=${process.pid})`)
  }
} catch (error) {
  if (isQualityGateBusyError(error)) {
    console.log(formatQualityGateSkipMessage(error))
    process.exit(0)
  }
  console.error(`quality-gate-lock: BLOCKED — ${String(error?.message || error)}`)
  process.exit(73)
}

const child = spawn(command, commandArgs, {
  cwd: process.cwd(),
  env: process.env,
  shell: useShell,
  stdio: 'inherit',
})

let shuttingDown = false
const forwardSignal = (signal) => {
  if (shuttingDown) return
  shuttingDown = true
  try {
    child.kill(signal)
  } catch {
    // child may already be gone
  }
}

process.on('SIGINT', () => forwardSignal('SIGINT'))
process.on('SIGTERM', () => forwardSignal('SIGTERM'))
process.on('exit', releaseQualityGateLock)

child.on('error', (error) => {
  console.error(`quality-gate-lock: failed to start ${name}: ${error.message}`)
  releaseQualityGateLock()
  process.exit(1)
})

child.on('exit', (code, signal) => {
  releaseQualityGateLock()
  if (signal) {
    process.exit(signal === 'SIGINT' ? 130 : 143)
  }
  process.exit(code ?? 1)
})
