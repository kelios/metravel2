#!/usr/bin/env node

'use strict'

const { spawn } = require('node:child_process')
const {
  acquireBuildLock,
  releaseBuildLock,
} = require('./build-lock')

const separatorIndex = process.argv.indexOf('--')
const command = separatorIndex >= 0 ? process.argv[separatorIndex + 1] : ''
const args = separatorIndex >= 0 ? process.argv.slice(separatorIndex + 2) : []

if (!command) {
  console.error('build-lock: command is required after `--`.')
  process.exit(2)
}

acquireBuildLock()
console.log(`build-lock: acquired for complete build/deploy (pid=${process.pid})`)
process.on('exit', releaseBuildLock)

const child = spawn(command, args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
})

let shuttingDown = false
const forwardSignal = (signal) => {
  if (shuttingDown) return
  shuttingDown = true
  try {
    child.kill(signal)
  } catch {
    // child may already have exited
  }
}

process.on('SIGINT', () => forwardSignal('SIGINT'))
process.on('SIGTERM', () => forwardSignal('SIGTERM'))

child.on('error', (error) => {
  console.error(`build-lock: failed to start ${command}: ${error.message}`)
  releaseBuildLock()
  process.exit(1)
})

child.on('exit', (code, signal) => {
  releaseBuildLock()
  if (signal) process.exit(signal === 'SIGINT' ? 130 : 143)
  process.exit(code ?? 1)
})
