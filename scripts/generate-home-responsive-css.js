#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { buildHomeResponsiveCss } = require('./lib/homeResponsiveCss')

const START_MARKER = '/* generated:home-responsive:start */'
const END_MARKER = '/* generated:home-responsive:end */'
const STYLESHEET = path.resolve(__dirname, '../app/global.css')

function renderHomeResponsiveCssRegion(source) {
  const starts = source.split(START_MARKER).length - 1
  const ends = source.split(END_MARKER).length - 1
  if (starts !== ends || starts > 1) throw new Error('Invalid responsive-home CSS region markers')
  const generated = `${START_MARKER}\n${buildHomeResponsiveCss().trim()}\n${END_MARKER}\n`
  if (!starts) {
    const separator = source.endsWith('\n\n') ? '' : source.endsWith('\n') ? '\n' : '\n\n'
    return source + separator + generated
  }
  const start = source.indexOf(START_MARKER)
  const end = source.indexOf(END_MARKER)
  if (end < start || source.slice(end + END_MARKER.length).trim()) {
    throw new Error('Responsive-home CSS region must be last in the root stylesheet')
  }
  return source.slice(0, start) + generated
}

function generateHomeResponsiveCss({ check = false } = {}) {
  const source = fs.readFileSync(STYLESHEET, 'utf8')
  const next = renderHomeResponsiveCssRegion(source)
  if (next === source) return true
  if (check) return false
  fs.writeFileSync(STYLESHEET, next)
  return true
}

if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.some((arg) => arg !== '--check')) throw new Error('Usage: generate-home-responsive-css.js [--check]')
  if (!generateHomeResponsiveCss({ check: args.includes('--check') })) {
    console.error('Responsive-home CSS is stale: run node scripts/generate-home-responsive-css.js')
    process.exitCode = 1
  }
}

module.exports = { START_MARKER, END_MARKER, renderHomeResponsiveCssRegion, generateHomeResponsiveCss }
