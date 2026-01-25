#!/usr/bin/env node

const { spawn } = require('child_process')

const args = process.argv.slice(2)

const getArg = (name) => {
  const idx = args.indexOf(name)
  if (idx === -1) return undefined
  return args[idx + 1]
}

const formFactorRaw = getArg('--formFactor')
const outputPath = getArg('--output')

const urlFromEnv = process.env.LIGHTHOUSE_URL
const urlFromArg = getArg('--url')

const defaultUrl =
  'https://metravel.by/travels/tropa-vedm-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-vygliadit-na-samom-dele'

const url = urlFromArg || urlFromEnv || defaultUrl

if (!outputPath) {
  console.error('❌ Missing --output <path>')
  process.exit(1)
}

const formFactor = String(formFactorRaw || 'mobile').toLowerCase()
if (formFactor !== 'mobile' && formFactor !== 'desktop') {
  console.error('❌ Invalid --formFactor. Use mobile or desktop')
  process.exit(1)
}

const lighthouseArgs = [
  'lighthouse',
  url,
  '--only-categories=performance',
  `--emulated-form-factor=${formFactor}`,
  '--throttling-method=simulate',
  '--output=json',
  `--output-path=${outputPath}`,
  '--quiet',
]

const child = spawn('npx', lighthouseArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

child.on('exit', (code) => process.exit(code || 0))
child.on('error', (error) => {
  console.error('❌ Failed to run Lighthouse:', error)
  process.exit(1)
})
