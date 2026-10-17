#!/usr/bin/env node
'use strict'

const { captureWorker, supervise: superviseOwned } = require('./lib/ownedProcessSupervisor')
const { parseCliArgs, runCli, UsageError } = require('./lib/cli-contract')

const CLI_SPEC = {
  name: 'seo-inputs-supervisor',
  usage: 'Usage: node scripts/seo-inputs-supervisor.js <supervise|worker> <command-argv-json>',
  selection: 'none',
  positionals: { key: 'operands', min: 2 },
}

function supervise(command, label = 'SEO input collection') {
  return superviseOwned(command, label)
}
async function main() {
  const { operands } = parseCliArgs(process.argv, CLI_SPEC)
  const [action, raw] = operands
  if (operands.length !== 2 || !['supervise', 'worker'].includes(action)) throw new UsageError('Exact supervisor action and command argv required')
  let command
  try { command = JSON.parse(raw) } catch { throw new UsageError('Command argv must be valid JSON') }
  if (!Array.isArray(command) || !command.length || !command[0]
    || command.some(value => typeof value !== 'string')) throw new UsageError('Command argv required')
  process.exitCode = await (action === 'worker' ? captureWorker(command) : supervise(command))
}
if (require.main === module) runCli(main, CLI_SPEC)
module.exports = { supervise }
