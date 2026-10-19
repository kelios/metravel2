#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { parseCliArgs, runCli, UsageError } = require('./lib/cli-contract')
const { collectSources } = require('./lib/metrics-summary-sources')
const { reportingWindow, buildSummary, renderMarkdown } = require('./lib/metrics-summary')

const CLI_SPEC = {
  name: 'stats:summary',
  usage: 'npm run stats:summary -- [--end-month YYYY-MM] [--property ID] [--json]\nПо умолчанию: последние 12 завершённых месяцев; Markdown в .codex-temp/metrics-summary/YYYY-MM-DD.md.\nПовторный запуск в тот же день обновляет отчёт. Недоступные источники дают instrumentation gap.',
  selection: 'none',
  flags: {
    'end-month': { type: 'string' },
    property: { type: 'string', default: process.env.GA4_PROPERTY_ID || '362328641' },
    json: { type: 'boolean' },
  },
}

async function main(argv = process.argv) {
  const args = parseCliArgs(argv, CLI_SPEC)
  if (!/^\d+$/.test(args.property)) throw new UsageError('--property должен быть числовым ID ресурса GA4')
  const now = new Date()
  let window
  try { window = reportingWindow(now, args.endMonth || undefined) } catch (error) { throw new UsageError(error.message) }
  const sources = await collectSources({ window, now, property: args.property })
  const report = buildSummary(sources, { window, now })
  const folder = path.resolve(__dirname, '../.codex-temp/metrics-summary')
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 })
  const output = path.join(folder, `${report.runDate}.md`)
  fs.writeFileSync(output, renderMarkdown(report), { mode: 0o600 })
  if (args.json) console.log(JSON.stringify({ output, ...report }, null, 2))
  else console.log(`Отчёт: ${output}\nОкно: ${window.from} — ${window.to}; 12 месяцев. Ограничений: ${report.gaps.length}.`)
  return report
}

if (require.main === module) runCli(main, CLI_SPEC)

module.exports = { CLI_SPEC, main }
