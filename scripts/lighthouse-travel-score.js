#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const host = process.env.LIGHTHOUSE_HOST || '127.0.0.1'
const port = Number(process.env.LIGHTHOUSE_PORT || 4173)
const travelPath =
  process.env.LIGHTHOUSE_PATH ||
  '/travels/czarny-staw-i-drugie-radosti-treki-termy-i-nochi-u-kamina'
const formFactor = String(process.env.LIGHTHOUSE_FORM_FACTOR || 'mobile').toLowerCase()
const minScore = Number(process.env.LIGHTHOUSE_MIN_SCORE || 0.8)
const reportPath = path.resolve(
  process.env.LIGHTHOUSE_REPORT || path.join(process.cwd(), 'lighthouse-report.travel.json')
)

const targetUrl = `http://${host}:${port}${travelPath.startsWith('/') ? '' : '/'}${travelPath}`

const flags = ['--only-categories=performance', '--throttling-method=simulate']
if (formFactor === 'desktop') {
  flags.push('--emulated-form-factor=desktop')
} else {
  flags.push('--emulated-form-factor=mobile')
}

const env = {
  ...process.env,
  LIGHTHOUSE_URL: targetUrl,
  LIGHTHOUSE_REPORT: reportPath,
  LIGHTHOUSE_FLAGS: flags.join(' '),
  LIGHTHOUSE_API_INSECURE: process.env.LIGHTHOUSE_API_INSECURE || '1',
}

const child = spawn('node', [path.join(__dirname, 'run-lighthouse.js')], {
  stdio: 'inherit',
  env,
})

child.on('exit', (code) => {
  if (code !== 0) {
    process.exit(code || 1)
  }

  let json
  try {
    json = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  } catch (error) {
    console.error('❌ Failed to read Lighthouse report:', error)
    process.exit(1)
  }

  const score = json?.categories?.performance?.score
  const numericScore = typeof score === 'number' ? score : 0
  const percent = Math.round(numericScore * 100)

  console.log(`✅ Lighthouse performance score: ${percent}`)

  if (numericScore < minScore) {
    console.error(`❌ Score ниже порога ${Math.round(minScore * 100)}`)
    process.exit(1)
  }
})

child.on('error', (error) => {
  console.error('❌ Failed to run Lighthouse:', error)
  process.exit(1)
})
