import fs from 'node:fs'
import path from 'node:path'

const {
  evaluateAuditResult,
  runAudit,
} = require('../../scripts/yarn-audit-high')

const fixture = (name: string) => fs.readFileSync(
  path.resolve(__dirname, `../fixtures/yarn-audit/${name}`),
  'utf8',
)

const validZeroAudit = `${JSON.stringify({
  type: 'auditSummary',
  data: {
    vulnerabilities: {
      info: 0,
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
    },
    dependencies: 200,
    devDependencies: 300,
    optionalDependencies: 5,
    totalDependencies: 505,
  },
})}\n`

describe('yarn audit high wrapper', () => {
  it('fails closed for a JSON registry error and unsuccessful child exit', () => {
    const secretSentinel = 'synthetic-registry-token-never-print'
    const stdout: string[] = []
    const stderr: string[] = []

    const exitCode = runAudit({
      spawnAudit: () => ({
        status: 1,
        stdout: `${JSON.stringify({ type: 'info', data: 'Visit documentation' })}\n`,
        stderr: `${fixture('http-410-error.jsonl')}${secretSentinel}\n`,
      }),
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => stderr.push(value) },
    })

    const output = `${stdout.join('')}\n${stderr.join('')}`
    expect(exitCode).toBe(1)
    expect(output).toContain('FAILED CLOSED')
    expect(output).toContain('registry/tool error')
    expect(output).not.toContain('yarn audit: OK')
    expect(output).not.toContain(secretSentinel)
  })

  it.each([
    ['malformed JSON', 'not-json\n'],
    ['missing summary', `${JSON.stringify({ type: 'info', data: 'no summary' })}\n`],
    ['error record with a zero child exit', fixture('http-410-error.jsonl')],
  ])('fails closed for %s', (_label, stdout) => {
    const outcome = evaluateAuditResult({ status: 0, stdout, stderr: '' })

    expect(outcome.exitCode).toBe(1)
    expect(outcome.stdout).toBe('')
    expect(outcome.stderr).toContain('FAILED CLOSED')
  })

  it('fails closed when a zero-exit child writes a JSON error record to stderr', () => {
    const outcome = evaluateAuditResult({
      status: 0,
      stdout: validZeroAudit,
      stderr: fixture('http-410-error.jsonl'),
    })

    expect(outcome.exitCode).toBe(1)
    expect(outcome.stdout).toBe('')
    expect(outcome.stderr).toContain('registry/tool error record')
  })

  it('fails closed when the child exits unsuccessfully despite a valid summary', () => {
    const outcome = evaluateAuditResult({ status: 2, stdout: validZeroAudit, stderr: '' })

    expect(outcome.exitCode).toBe(1)
    expect(outcome.stderr).toContain('unexpected child exit status')
    expect(outcome.stderr).not.toContain('yarn audit: OK')
  })

  it('accepts a valid zero-advisory summary', () => {
    const outcome = evaluateAuditResult({ status: 0, stdout: validZeroAudit, stderr: '' })

    expect(outcome).toMatchObject({ exitCode: 0, stderr: '' })
    expect(outcome.stdout).toContain('high/critical: 0, moderate: 0, low: 0')
    expect(outcome.stdout).toContain('allowed ignored modules: node-forge')
  })

  it('preserves advisory counts and reports the explicit ignored-module policy', () => {
    const outcome = evaluateAuditResult({
      status: 14,
      stdout: fixture('valid-advisory-stream.jsonl'),
      stderr: '',
    })

    expect(outcome).toMatchObject({ exitCode: 0, stderr: '' })
    expect(outcome.stdout).toContain('high/critical: 0, moderate: 1, low: 1, ignored: 1')
    expect(outcome.stdout).toContain('allowed ignored modules: node-forge')
  })

  it('keeps non-ignored high advisories release-blocking', () => {
    const highAudit = fixture('valid-advisory-stream.jsonl')
      .replace('"module_name":"node-forge"', '"module_name":"unignored-package"')

    const outcome = evaluateAuditResult({ status: 14, stdout: highAudit, stderr: '' })

    expect(outcome.exitCode).toBe(1)
    expect(outcome.stdout).toBe('')
    expect(outcome.stderr).toContain('high/critical vulnerabilities')
    expect(outcome.stderr).toContain('high/critical: 1')
  })

  describe('GHSA-scoped advisory exceptions', () => {
    const highAdvisoryStream = (advisories: Array<{ module: string; ghsa: string; path: string }>) => [
      ...advisories.map(({ module, ghsa, path: resolutionPath }, index) => JSON.stringify({
        type: 'auditAdvisory',
        data: {
          resolution: { id: 2000 + index, path: resolutionPath, dev: false },
          advisory: { module_name: module, severity: 'high', github_advisory_id: ghsa.toLowerCase() },
        },
      })),
      JSON.stringify({
        type: 'auditSummary',
        data: {
          vulnerabilities: { info: 0, low: 0, moderate: 0, high: advisories.length, critical: 0 },
          totalDependencies: 505,
        },
      }),
    ].join('\n')

    it('ignores the zod advisory only on the pinned @expo/cli path', () => {
      const outcome = evaluateAuditResult({
        status: 8,
        stdout: highAdvisoryStream([
          { module: 'zod', ghsa: 'GHSA-MRHX-C7XC-M3W5', path: 'expo>@expo/cli>zod' },
          { module: 'node-forge', ghsa: 'GHSA-86W9-CPQP-85RV', path: 'expo>@expo/cli>node-forge' },
        ]),
        stderr: '',
      })

      expect(outcome).toMatchObject({ exitCode: 0, stderr: '' })
      expect(outcome.stdout).toContain('high/critical: 0')
      expect(outcome.stdout).toContain('ignored: 2')
      expect(outcome.stdout).toContain('zod/GHSA-MRHX-C7XC-M3W5')
    })

    it.each([
      ['the same zod advisory on another dependency path', 'GHSA-MRHX-C7XC-M3W5', 'zod'],
      ['an unlisted zod advisory on the pinned path', 'GHSA-0000-0000-0000', 'expo>@expo/cli>zod'],
    ])('keeps %s release-blocking', (_label, ghsa, resolutionPath) => {
      const outcome = evaluateAuditResult({
        status: 8,
        stdout: highAdvisoryStream([{ module: 'zod', ghsa, path: resolutionPath }]),
        stderr: '',
      })

      expect(outcome.exitCode).toBe(1)
      expect(outcome.stdout).toBe('')
      expect(outcome.stderr).toContain('high/critical: 1')
    })
  })

  it('rejects a child status that does not match the trustworthy summary bitmask', () => {
    const outcome = evaluateAuditResult({
      status: 0,
      stdout: fixture('valid-advisory-stream.jsonl'),
      stderr: '',
    })

    expect(outcome.exitCode).toBe(1)
    expect(outcome.stdout).toBe('')
    expect(outcome.stderr).toContain('unexpected child exit status')
  })

  it('rejects an advisory stream that contradicts its summary counts', () => {
    const mismatchedAudit = fixture('valid-advisory-stream.jsonl')
      .replace('"high":1', '"high":0')
    const outcome = evaluateAuditResult({ status: 6, stdout: mismatchedAudit, stderr: '' })

    expect(outcome.exitCode).toBe(1)
    expect(outcome.stdout).toBe('')
    expect(outcome.stderr).toContain('audit summary/advisory mismatch')
  })
})
