#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { parseArgs } = require('node:util')
const { execFileSync } = require('node:child_process')
const { randomUUID } = require('node:crypto')
const { FLOW_ROOT, loadManifest, assertJunitPass, runBounded, validateSelection } = require('./native-e2e-lib')
const { acquireDeviceLock } = require('./native-device-lock')
const { acquireQualityGateLock, releaseQualityGateLock } = require('./quality-gate-lock')

async function main() {
  const { values: options } = parseArgs({ options: Object.fromEntries([
    ...['suite', 'platform', 'device', 'account', 'locale', 'api-url', 'version', 'build'].map((name) => [name, { type: 'string' }]),
    ['check', { type: 'boolean' }], ['dev-client', { type: 'boolean' }],
  ]) })
  const { manifest, files, definitionSha256 } = loadManifest()
  if (options.check) {
    console.log(JSON.stringify({ status: 'source-validated', suites: Object.keys(manifest.suites), files, definitionSha256, runtimeExecuted: false, completeReviewScenes: [] }, null, 2))
    return
  }
  const suite = validateSelection(manifest, options)
  const abort = new AbortController()
  const cancel = () => abort.abort()
  const started = Date.now()
  const out = path.resolve('.codex-temp/native-e2e', `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`)
  fs.mkdirSync(out, { recursive: true })
  const report = {
    schemaVersion: 1, status: 'blocked', suite: options.suite, platform: options.platform,
    version: options.version, build: options.build, declaredApiOrigin: new URL(options['api-url']).origin,
    account: options.account, locale: options.locale, devClient: Boolean(options['dev-client']),
    workspaceSourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    definitionSha256, startedAt: new Date(started).toISOString(), checks: suite.checks,
    completeReviewScenes: [], candidateSourceVerified: false, recordingReady: false, flows: [],
  }
  const probe = async (command, args) => {
    const remaining = manifest.limits.suiteSeconds * 1000 - (Date.now() - started)
    if (remaining <= 0) throw new Error('Native suite time budget exhausted during preflight')
    const result = await runBounded(command, args, { timeoutMs: Math.min(15000, remaining), signal: abort.signal })
    if (result.code !== 0) throw new Error(`Native preflight failed: ${command} (exit ${result.code}); check tool/device readiness`)
    return result.output
  }
  let releaseDevice
  try {
    acquireQualityGateLock({ name: 'native-e2e' })
    releaseDevice = acquireDeviceLock({ device: options.device, name: 'maestro' })
  } catch (error) {
    releaseQualityGateLock()
    throw error
  }
  process.once('SIGINT', cancel)
  process.once('SIGTERM', cancel)
  try {
    if (options.platform === 'android') {
      if ((await probe('adb', ['-s', options.device, 'get-state'])).trim() !== 'device') throw new Error('Selected Android device is not ready')
      const info = await probe('adb', ['-s', options.device, 'shell', 'dumpsys', 'package', manifest.appId])
      if (info.match(/versionName=([^\s]+)/)?.[1] !== options.version || info.match(/versionCode=(\d+)/)?.[1] !== options.build) throw new Error('Installed Android version/build does not match the candidate')
    } else {
      const devices = JSON.parse(await probe('xcrun', ['simctl', 'list', 'devices', 'booted', '--json']))
      if (!Object.values(devices.devices).flat().some((device) => device.udid === options.device && device.state === 'Booted')) throw new Error('Selected iOS simulator is not booted; physical iOS uses XCTest')
      const app = (await probe('xcrun', ['simctl', 'get_app_container', options.device, manifest.appId, 'app'])).trim()
      for (const [key, expected] of [['CFBundleShortVersionString', options.version], ['CFBundleVersion', options.build]]) {
        if ((await probe('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, path.join(app, 'Info.plist')])).trim() !== expected) throw new Error('Installed simulator version/build does not match the candidate')
      }
    }
    const maestro = process.env.MAESTRO_BIN || 'maestro'
    report.maestroVersion = (await probe(maestro, ['--version'])).trim()
    for (const file of suite.flows) {
      const remaining = manifest.limits.suiteSeconds * 1000 - (Date.now() - started)
      if (remaining <= 0) throw new Error('Native suite time budget exhausted')
      const flowOut = path.join(out, path.basename(file, '.yaml'))
      fs.mkdirSync(flowOut)
      const junit = path.join(flowOut, 'junit.xml')
      const result = await runBounded(maestro, [
        '--device', options.device, 'test', '--format', 'junit', '--output', junit,
        '--debug-output', flowOut, '-e', `DEV_CLIENT=${options['dev-client'] ? '1' : '0'}`, path.join(FLOW_ROOT, file),
      ], { timeoutMs: Math.min(remaining, manifest.limits.flowSeconds * 1000), logPath: path.join(flowOut, 'maestro.log'), signal: abort.signal })
      const flow = { file, status: 'fail', exitCode: result.code, timedOut: result.timedOut }
      report.flows.push(flow)
      if (result.code !== 0) throw new Error(`${file} failed (exit ${result.code}); stopped without retry`)
      flow.testCases = assertJunitPass(fs.readFileSync(junit, 'utf8'))
      flow.status = 'pass'
    }
    report.status = 'pass'
  } catch (error) {
    report.status = abort.signal.aborted ? 'cancelled' : report.flows.length ? 'fail' : 'blocked'
    report.failure = error.message
    process.exitCode = abort.signal.aborted ? 130 : 1
  } finally {
    report.finishedAt = new Date().toISOString()
    report.elapsedSeconds = Math.round((Date.now() - started) / 1000)
    releaseDevice()
    releaseQualityGateLock()
    process.removeListener('SIGINT', cancel)
    process.removeListener('SIGTERM', cancel)
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2), { mode: 0o600 })
    console.log(`native-e2e ${report.status}: ${path.join(out, 'report.json')}`)
    if (report.failure) console.error(report.failure)
  }
}

main().catch((error) => { console.error(`native-e2e BLOCKED: ${error.message}`); process.exitCode = 73 })
