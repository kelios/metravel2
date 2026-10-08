#!/usr/bin/env node
'use strict'

// Prepare/reuse a verified primary QA104 session. Secrets never go to stdout or
// generated argv; callers import createTokenSession and request through it.
const path = require('node:path')
const { createTokenSession, qaTokenSources, TokenError, formatTokenError } = require('./lib/metravel-token')

const USAGE = 'Usage: node -- scripts/get-quest-token.js [--api-url=https://metravel.by] [--env-file=.env.e2e]\nVerifies QA104 and prepares its dedicated cache; outputs status only.'

function parseArgs(args) {
  const options = {}
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') return { help: true }
    const match = /^--(api-url|env-file)(?:=(.*))?$/.exec(arg)
    if (!match || Object.prototype.hasOwnProperty.call(options, match[1])) throw new TokenError('configuration', { operation: 'cli' })
    const value = match[2] === undefined ? args[++index] : match[2]
    if (!value || value.startsWith('--')) throw new TokenError('configuration', { operation: 'cli' })
    options[match[1]] = value
  }
  return options
}

async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args)
  if (options.help) { process.stdout.write(`${USAGE}\n`); return }
  if (options['env-file'] && path.basename(path.resolve(options['env-file'])) !== '.env.e2e') throw new TokenError('credentials', { operation: 'cli' })
  const session = createTokenSession({
    origin: options['api-url'] || 'https://metravel.by', profile: 'qa104', expectedUserId: 104,
    sources: qaTokenSources(), refreshPolicy: 'primary-qa',
    credentials: { envFile: path.resolve(options['env-file'] || '.env.e2e') },
  })
  await session.ensureToken()
  process.stdout.write(`${JSON.stringify({ status: 'ready', userId: 104 })}\n`)
}

if (require.main === module) {
  main().catch((error) => { process.stderr.write(`${formatTokenError(error)}\n`); process.exitCode = 1 })
}
module.exports = { main, parseArgs }
