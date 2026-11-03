#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
const PLATFORM_CHECKS = {
  android: ['android:release:doctor'],
  ios: ['ios:release:guard', 'ios:store:guard'],
}
const SHARED_CONTRACTS = new Set([
  'AuthContext', 'authNavigation', 'externalLinks', 'FavoriteButton', 'notifications',
  'security', 'UpsertTravel.createEditFlow',
])
const PLATFORM_MARKERS = {
  android: /Android|(?:^|[.-])android(?=[.\-A-Z]|$)/,
  ios: /iOS|IOS|Ios|AppleSignIn|(?:^|[.-])ios(?=[.\-A-Z]|$)/,
}

function selectTests(files, platform) {
  const otherPlatform = platform === 'android' ? 'ios' : 'android'
  return files.filter(file => {
    const name = path.basename(file).replace(/\.test\.tsx?$/, '')
    if (name === path.basename(file) || /(?:^|[.-])web(?:[.-]|$)/.test(name)) return false
    if (PLATFORM_MARKERS[platform].test(name)) return true
    if (PLATFORM_MARKERS[otherPlatform].test(name)) return false
    const sharedLocale = file.split(path.sep)[0] === 'i18n' &&
      !/^(?:web|ssg|ssr)|Seo/.test(name)
    return /Native|(?:^|[.-])native(?=[.\-A-Z]|$)/.test(name) || sharedLocale || SHARED_CONTRACTS.has(name)
  }).sort()
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} exited with ${result.status ?? result.signal}`)
  }
}

function main([platform, option, ...extra]) {
  if (!Object.hasOwn(PLATFORM_CHECKS, platform) || (option && option !== '--list') || extra.length) {
    throw new Error('Usage: native-release-check.js <android|ios> [--list]')
  }
  const testDir = path.join(ROOT, '__tests__')
  const tests = selectTests(fs.readdirSync(testDir, { recursive: true }), platform)
    .map(file => path.join('__tests__', file))
  if (tests.length === 0) throw new Error(`No tests selected for ${platform}`)
  if (option === '--list') {
    console.log(tests.join('\n'))
    return
  }

  const packageManager = process.env.npm_execpath
  if (!packageManager) throw new Error(`Run npm run ${platform}:release:check`)
  for (const script of [...PLATFORM_CHECKS[platform], 'typecheck', 'guard:external-links', 'audit:high']) {
    run(process.execPath, [packageManager, 'run', script])
  }
  run('bash', ['verify-security-fixes.sh'])
  console.log(`[native-release-check] ${platform}: running ${tests.length} Jest suites`)
  run(process.execPath, [path.join(ROOT, 'node_modules/jest/bin/jest.js'), '--runInBand', '--runTestsByPath', ...tests])
  console.log(`[native-release-check] ${platform}: PASS`)
}

if (require.main === module) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(`[native-release-check] ${error.message}`)
    process.exitCode = 1
  }
}

module.exports = { selectTests }
