#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { runnerSourceHash, validateSteps, assertExecutionReceipt } = require('../tools/ios-device-uitests/run')

const MAX_AGE_MS = 24 * 60 * 60 * 1000
const CANDIDATE_KEYS = ['version', 'build', 'source', 'origin']
const ENVIRONMENT_KEYS = ['apiUrl', 'locale', 'accountRole', 'deviceModel']

function validateReadiness(plan, { directory = process.cwd(), now = Date.now() } = {}) {
  const failures = []
  const fail = (message) => failures.push(message)
  const nonempty = (value) => typeof value === 'string' && value.trim().length > 0
  if (plan?.schemaVersion !== 1 || !['regression', 'app-review'].includes(plan?.purpose)) fail('Plan requires schemaVersion=1 and purpose=regression|app-review')
  for (const [group, keys] of [['candidate', CANDIDATE_KEYS], ['environment', ENVIRONMENT_KEYS]]) {
    for (const key of keys) if (!nonempty(plan?.[group]?.[key])) fail(`Missing ${group}.${key}`)
  }
  if (!/^[a-f0-9]{40}$/i.test(plan?.candidate?.source || '')) fail('candidate.source must be a full commit SHA')
  if (!/^[a-f0-9]{64}$/.test(plan?.runnerFingerprint || '')) fail('Missing runnerFingerprint')
  try {
    const url = new URL(plan?.environment?.apiUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) fail('Invalid environment.apiUrl')
  } catch { fail('Invalid environment.apiUrl') }
  if (plan?.purpose === 'app-review' && plan?.candidate?.origin !== 'testflight') fail('App Review requires declared TestFlight candidate origin; installed provenance must be verified separately')
  if (!Array.isArray(plan?.scenes) || !plan.scenes.length) {
    fail('No scenes requested')
    return failures
  }
  const currentRunner = runnerSourceHash()
  const catalog = require('../.codex/skills/metravel-app-review-evidence/scenes.json').scenes
  const knownScenes = new Map(catalog.map((scene) => [scene.id, scene]))
  const knownSegments = new Set(catalog.flatMap((scene) => (scene.requiredSegments || []).map((segment) => `${scene.id}/${segment}`)))
  const seen = new Set()
  for (const scene of plan.scenes) {
    const id = scene?.id
    const segment = scene?.segment
    const key = segment === undefined ? id : `${id}/${segment}`
    const label = /^[a-z0-9][a-z0-9-]{0,79}$/.test(id || '') ? (typeof segment === 'string' && /^[a-z0-9-]{1,80}$/.test(segment) ? key : id) : 'scene'
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id || '') || seen.has(key)) fail('Missing or duplicate scene id')
    seen.add(key)
    if (plan.purpose === 'app-review' && !knownScenes.has(id)) fail(`${id}: unknown App Review scene`)
    if (segment !== undefined && (plan.purpose !== 'app-review' || typeof segment !== 'string' || !knownSegments.has(key))) fail(`${label}: unknown App Review segment mapping`)
    try {
      if (!nonempty(scene.path) || !nonempty(scene.report)) throw new Error('scenario path and report are required')
      const raw = fs.readFileSync(path.resolve(directory, scene.path), 'utf8')
      const scenario = JSON.parse(raw)
      const report = JSON.parse(fs.readFileSync(path.resolve(directory, scene.report), 'utf8'))
      validateSteps(scenario.steps, false)
      if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(scenario.id || '')) fail(`${label}: missing or invalid scenario identity`)
      if (scenario.layer !== 'physical-ios' || !scenario.steps.some((step) => step.op === 'assert')) fail(`${label}: expected physical scenario with assertions`)
      if (plan.purpose === 'app-review') {
        const coverage = scenario.completeReviewSegments === undefined ? [] : scenario.completeReviewSegments
        if (!Array.isArray(coverage) || new Set(coverage).size !== coverage.length || coverage.some((value) => !knownSegments.has(value))) fail(`${label}: invalid complete App Review segment declarations`)
        if (segment !== undefined) {
          if (!Array.isArray(coverage) || !coverage.includes(key)) fail(`${label}: scenario does not cover this complete App Review segment`)
        } else {
          if (!Array.isArray(scenario.completeReviewScenes) || !scenario.completeReviewScenes.includes(id)) fail(`${label}: scenario does not cover this complete App Review scene`)
          if ((knownScenes.get(id)?.requiredSegments || []).some((value) => !Array.isArray(coverage) || !coverage.includes(`${id}/${value}`))) fail(`${label}: full scene requires every declared catalog segment`)
        }
      } else if (scenario.id !== id) fail(`${id}: regression id does not match scenario`)
      if (report.schemaVersion !== 1 || report.status !== 'passed' || report.exitCode !== 0 || report.layer !== 'physical-ios' || report.mode !== 'rehearsal') fail(`${label}: no successful physical rehearsal`)
      try { assertExecutionReceipt(report.execution, scenario.steps) } catch { fail(`${label}: missing or mismatched completed execution evidence`) }
      if (report.observedCandidate?.version !== plan.candidate?.version || report.observedCandidate?.build !== plan.candidate?.build) fail(`${label}: installed candidate was not verified`)
      if (report.scenario?.id !== scenario.id || report.scenario?.sha256 !== createHash('sha256').update(raw).digest('hex')) fail(`${label}: scenario changed since rehearsal`)
      if (report.runner?.sourceSha256 !== currentRunner || report.runner?.fingerprint !== plan.runnerFingerprint) fail(`${label}: runner identity changed`)
      for (const [group, keys] of [['candidate', CANDIDATE_KEYS], ['environment', ENVIRONMENT_KEYS]]) {
        for (const key of keys) if (report[group]?.[key] !== plan[group]?.[key]) fail(`${label}: ${group}.${key} mismatch`)
      }
      const start = Date.parse(report.startedAt)
      const finish = Date.parse(report.finishedAt)
      if (!Number.isFinite(start) || !Number.isFinite(finish) || start > finish || finish > now || now - start > MAX_AGE_MS) fail(`${label}: rehearsal is stale or has invalid timestamps`)
    } catch {
      // Do not echo raw JSON, paths from parse errors, account data or driver output.
      fail(`${label}: unreadable or invalid scenario/report`)
    }
  }
  return failures
}

function readinessMessage(plan) {
  const segments = plan.scenes.filter((scene) => scene.segment !== undefined).length
  return `REHEARSAL EVIDENCE CONSISTENT: ${plan.scenes.length - segments} scene request(s), ${segments} child segment request(s); no parent coverage inferred from children; independent installed candidate/source provenance (including TestFlight origin for App Review), API transport and account role verification still required; capture/privacy verification still required`
}

if (require.main === module) {
  try {
    const file = process.argv[2]
    if (!file || process.argv.length !== 3) throw new Error('Usage: native-recording-readiness.js <plan.json>')
    const plan = JSON.parse(fs.readFileSync(file, 'utf8'))
    const failures = validateReadiness(plan, { directory: path.dirname(path.resolve(file)) })
    if (failures.length) {
      console.error(`RECORDING BLOCKED\n${failures.map((failure) => `- ${failure}`).join('\n')}`)
      process.exitCode = 1
    } else console.log(readinessMessage(plan))
  } catch {
    console.error('RECORDING BLOCKED: provide a readable valid plan.json')
    process.exitCode = 2
  }
}

module.exports = { validateReadiness, readinessMessage, MAX_AGE_MS }
