#!/usr/bin/env node
'use strict'

const { readReport } = require('./lib/bundleBudgetReport')

function compareReports(before, after) {
  const lines = [`Bundle budget ${before.sha || 'unavailable'} -> ${after.sha || 'unavailable'}`]
  lines.push(`verdict: ${before.verdict} -> ${after.verdict}`)
  lines.push(`measurement_status: ${before.measurement_status} -> ${after.measurement_status}`)
  for (const key of ['status', 'source', 'route', 'requests_route']) {
    lines.push(`eager.${key}: ${before.measurements?.eager[key] ?? 'unavailable'} -> ${after.measurements?.eager[key] ?? 'unavailable'}`)
  }
  for (const key of ['config', 'toolchain']) {
    const previous = JSON.stringify(before[key])
    const current = JSON.stringify(after[key])
    lines.push(`${key}: ${previous === current ? 'unchanged' : `${previous} -> ${current}`}`)
  }
  const numbers = (value, prefix = '', result = new Map()) => {
    if (value === null || typeof value === 'number') result.set(prefix, value)
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, item] of Object.entries(value)) numbers(item, prefix ? `${prefix}.${key}` : key, result)
    }
    return result
  }
  const previous = numbers(before.measurements, 'measurements')
  const current = numbers(after.measurements, 'measurements')
  for (const key of [...new Set([...previous.keys(), ...current.keys()])].sort()) {
    const from = previous.get(key)
    const to = current.get(key)
    const measured = typeof from === 'number' && typeof to === 'number'
    const delta = measured ? `${to - from >= 0 ? '+' : ''}${to - from}` : 'unavailable'
    const unit = /\.(raw|gzip|brotli)$/.test(key) ? 'bytes' : 'count'
    lines.push(`${key}: ${from ?? 'unavailable'} -> ${to ?? 'unavailable'}; delta ${delta} ${unit}`)
  }
  lines.push(`breaches before: ${JSON.stringify(before.breaches)}`)
  lines.push(`breaches after: ${JSON.stringify(after.breaches)}`)
  return lines.join('\n')
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2)
    if (args.length !== 2) throw new Error('Usage: node scripts/compare-bundle-budget-reports.js <before.json> <after.json>')
    console.log(compareReports(readReport(args[0]), readReport(args[1])))
  } catch (error) {
    console.error(`Bundle budget comparison failed: ${error.message}`)
    process.exitCode = 1
  }
}

module.exports = { compareReports }
