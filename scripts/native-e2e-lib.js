'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { spawn } = require('node:child_process')
const YAML = require('yaml')
const { DOMParser } = require('@xmldom/xmldom')

const FLOW_ROOT = path.resolve(__dirname, '../e2e/maestro')

function loadManifest(root = FLOW_ROOT) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'suites.json'), 'utf8'))
  if (manifest.schemaVersion !== 1 || manifest.appId !== 'by.metravel.app' || manifest.locale !== 'ru') throw new Error('Invalid native suite manifest')
  for (const key of ['suiteSeconds', 'flowSeconds']) {
    const value = manifest.limits?.[key]
    if (!Number.isInteger(value) || value < 1 || value > 600) throw new Error(`Invalid ${key} budget`)
  }
  if (!manifest.suites || !Object.keys(manifest.suites).length) throw new Error('No native suites')
  const files = new Map()
  const inspectFlow = (file, ancestors = []) => {
    if (!/^[a-z0-9-]+\.yaml$/.test(file)) throw new Error(`Invalid flow filename: ${file}`)
    if (ancestors.includes(file)) throw new Error(`Circular runFlow: ${file}`)
    if (files.has(file)) return
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    const docs = YAML.parseAllDocuments(source)
    if (docs.some((doc) => doc.errors.length) || docs.length !== 2) throw new Error(`Invalid Maestro YAML: ${file}`)
    const [header, commands] = docs.map((doc) => doc.toJSON())
    if (header.appId !== manifest.appId || !Array.isArray(commands) || !commands.length) throw new Error(`Invalid Maestro flow: ${file}`)
    const walk = (value) => {
      if (!value || typeof value !== 'object') return
      if ('retry' in value) throw new Error(`Whole-action retries are forbidden: ${file}`)
      if (value.extendedWaitUntil?.timeout > manifest.limits.flowSeconds * 1000) throw new Error(`Wait exceeds flow budget: ${file}`)
      if (value.runFlow) {
        const dependency = typeof value.runFlow === 'string' ? value.runFlow : value.runFlow.file
        if (dependency) inspectFlow(dependency, [...ancestors, file])
      }
      for (const item of Object.values(value)) walk(item)
    }
    walk(commands)
    files.set(file, source)
  }
  for (const [name, suite] of Object.entries(manifest.suites)) {
    if (!/^[a-z0-9-]+$/.test(name) || !['guest', 'seeded'].includes(suite.account) || !suite.flows?.length) throw new Error(`Invalid suite: ${name}`)
    if (!suite.platforms?.length || suite.platforms.some((platform) => !['android', 'ios-simulator'].includes(platform))) throw new Error(`Unsupported platform: ${name}`)
    if (!Array.isArray(suite.checks) || !suite.checks.length) throw new Error(`Missing explicit checks: ${name}`)
    // These limited flows prove no complete App Review scene. Never inflate it.
    if (!Array.isArray(suite.completeReviewScenes) || suite.completeReviewScenes.length) throw new Error(`Unreviewed App Review coverage claim: ${name}`)
    suite.flows.forEach((file) => inspectFlow(file))
  }
  const hash = createHash('sha256').update(JSON.stringify(manifest))
  for (const [file, source] of [...files.entries()].sort()) hash.update(file).update(source)
  for (const file of ['native-e2e.js', 'native-e2e-lib.js', 'native-device-lock.js']) hash.update(fs.readFileSync(path.join(__dirname, file)))
  return { manifest, files: [...files.keys()], definitionSha256: hash.digest('hex') }
}

function assertJunitPass(xml) {
  const errors = []
  const document = new DOMParser({ errorHandler: { warning: (message) => errors.push(message), error: (message) => errors.push(message), fatalError: (message) => errors.push(message) } }).parseFromString(xml, 'application/xml')
  if (errors.length || !['testsuite', 'testsuites'].includes(document.documentElement?.tagName)) throw new Error('Malformed Maestro JUnit report')
  const cases = document.getElementsByTagName('testcase')
  if (!cases.length) throw new Error('Maestro reported no test cases')
  for (const tag of ['failure', 'error', 'skipped']) {
    if (document.getElementsByTagName(tag).length) throw new Error(`Maestro JUnit contains ${tag}`)
  }
  for (const suite of [...Array.from(document.getElementsByTagName('testsuite')), ...Array.from(document.getElementsByTagName('testsuites'))]) {
    for (const attr of ['failures', 'errors', 'skipped']) {
      if (Number(suite.getAttribute(attr) || 0) !== 0) throw new Error(`Maestro JUnit ${attr} is non-zero`)
    }
  }
  return cases.length
}

function runBounded(command, args, { timeoutMs, logPath, env = process.env, signal } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Positive subprocess timeout required')
  return new Promise((resolve) => {
    const fd = logPath ? fs.openSync(logPath, 'w', 0o600) : null
    let child
    let timer
    let escalation
    let timedOut = false
    let cancelled = false
    let settled = false
    let output = ''
    const stop = () => {
      if (!child?.pid) return
      try { process.kill(-child.pid, 'SIGTERM') } catch { /* Only our process group. */ }
      escalation = setTimeout(() => {
        try { process.kill(-child.pid, 'SIGKILL') } catch { /* It has exited. */ }
      }, 1500)
    }
    const cancel = () => { cancelled = true; stop() }
    const finish = (code, error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearTimeout(escalation)
      // The main process may close while a descendant ignores TERM and closes
      // its pipes. Do not leave that descendant controlling the device.
      if (child?.pid) {
        try { process.kill(-child.pid, 'SIGKILL') } catch { /* Our group has exited. */ }
      }
      signal?.removeEventListener('abort', cancel)
      if (fd !== null) fs.closeSync(fd)
      resolve({ code: timedOut ? 124 : cancelled ? 130 : (code ?? 1), timedOut, cancelled, output, error: error?.message })
    }
    if (signal?.aborted) { cancelled = true; finish(130); return }
    try {
      child = spawn(command, args, { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
      for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => {
        if (fd !== null) fs.writeSync(fd, chunk)
        if (output.length < 1024 * 1024) output += chunk.toString().slice(0, 1024 * 1024 - output.length)
      })
      child.once('error', (error) => finish(1, error))
      child.once('close', (code) => finish(code))
      signal?.addEventListener('abort', cancel, { once: true })
      timer = setTimeout(() => { timedOut = true; stop() }, timeoutMs)
    } catch (error) { finish(1, error) }
  })
}

function validateSelection(manifest, options) {
  const suite = manifest.suites[options.suite]
  if (!suite || !suite.platforms.includes(options.platform)) throw new Error('Select a known suite and supported platform')
  if (!options.device || !/^[a-zA-Z0-9_.:-]+$/.test(options.device)) throw new Error('An explicit device identifier is required')
  if (options.account !== suite.account) throw new Error(`Suite requires --account ${suite.account}`)
  if (options.locale !== manifest.locale) throw new Error('Current Maestro selectors require --locale ru; other locales are not covered')
  if (!/^\d+$/.test(options.build || '') || !/^\d+(?:\.\d+){0,3}$/.test(options.version || '')) throw new Error('--build and --version must identify the installed candidate')
  const api = new URL(options['api-url'])
  if (!['http:', 'https:'].includes(api.protocol) || api.username || api.password || api.search || api.hash || !['', '/', '/api', '/api/'].includes(api.pathname)) throw new Error('--api-url must be an API origin without credentials')
  return suite
}

module.exports = { FLOW_ROOT, loadManifest, assertJunitPass, runBounded, validateSelection }
