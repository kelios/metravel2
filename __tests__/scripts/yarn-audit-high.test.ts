import fs from 'node:fs'
import path from 'node:path'

const {
  evaluateAuditResult,
  loadAcceptedAdvisories,
  parseAcceptedAdvisories,
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
  })

  it('keeps node-forge high advisories release-blocking', () => {
    const outcome = evaluateAuditResult({
      status: 14,
      stdout: fixture('valid-advisory-stream.jsonl'),
      stderr: '',
    })

    expect(outcome.exitCode).toBe(1)
    expect(outcome.stderr).toContain('high/critical: 1, moderate: 1, low: 1')
  })

  it('blocks the previously excepted zod advisory on the Expo CLI path', () => {
    const advisory = {
      type: 'auditAdvisory',
      data: {
        resolution: { id: 2000, path: 'expo>@expo/cli>zod', dev: false },
        advisory: { module_name: 'zod', severity: 'high', github_advisory_id: 'GHSA-MRHX-C7XC-M3W5' },
      },
    }
    const summary = {
      type: 'auditSummary',
      data: {
        vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 },
        totalDependencies: 505,
      },
    }
    const outcome = evaluateAuditResult({
      status: 8,
      stdout: [advisory, summary].map((record) => JSON.stringify(record)).join('\n'),
      stderr: '',
    })

    expect(outcome.exitCode).toBe(1)
    expect(outcome.stdout).toBe('')
    expect(outcome.stderr).toContain('high/critical: 1')
  })

  describe('#3407: low/moderate advisories need triage', () => {
    const moderateAudit = (advisories: Array<{ id?: string; module: string; severity: string }>) => {
      const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 } as Record<string, number>
      for (const item of advisories) counts[item.severity] += 1
      const records = [
        ...advisories.map((item) => ({
          type: 'auditAdvisory',
          data: { advisory: { module_name: item.module, severity: item.severity, github_advisory_id: item.id } },
        })),
        // Yarn печатает запись на каждый путь: дубль не должен считаться второй уязвимостью.
        ...advisories.slice(0, 1).map((item) => ({
          type: 'auditAdvisory',
          data: { advisory: { module_name: item.module, severity: item.severity, github_advisory_id: item.id } },
        })),
        { type: 'auditSummary', data: { vulnerabilities: { ...counts, [advisories[0].severity]: counts[advisories[0].severity] + 1 }, totalDependencies: 505 } },
      ]
      const status = (counts.low > 0 ? 2 : 0) + (counts.moderate > 0 ? 4 : 0)
      return { status, stdout: records.map((record) => JSON.stringify(record)).join('\n'), stderr: '' }
    }
    const accepted = (entries: Array<{ id: string; module: string; reviewBy: string }>) => parseAcceptedAdvisories(JSON.stringify({
      accepted: entries.map((entry) => ({ ...entry, reason: 'Только инструменты сборки, пользовательский ввод не попадает.' })),
    }))
    const glob = { id: 'GHSA-3g3m-2fjr-6pw4', module: 'glob', severity: 'moderate' }
    const quill = { id: 'GHSA-v3m3-f69x-jf25', module: 'quill', severity: 'low' }

    it('fails on an advisory that is not in the accepted list', () => {
      const outcome = evaluateAuditResult(moderateAudit([glob, quill]), {
        accepted: accepted([{ id: glob.id, module: 'glob', reviewBy: '2027-02-14' }]),
        today: '2026-11-14',
      })

      expect(outcome.exitCode).toBe(1)
      expect(outcome.stdout).toBe('')
      expect(outcome.stderr).toContain('untriaged low/moderate advisories')
      expect(outcome.stderr).toContain('GHSA-V3M3-F69X-JF25 quill (low)')
      expect(outcome.stderr).not.toContain('glob')
    })

    it('passes when every reported advisory is accepted, ids compared case-insensitively', () => {
      const outcome = evaluateAuditResult(moderateAudit([glob, quill]), {
        accepted: accepted([
          { id: glob.id.toLowerCase(), module: 'glob', reviewBy: '2027-02-14' },
          { id: quill.id, module: 'quill', reviewBy: '2026-11-14' },
        ]),
        today: '2026-11-14',
      })

      expect(outcome).toMatchObject({ exitCode: 0, stderr: '' })
      expect(outcome.stdout).toContain('accepted low/moderate advisories: 2')
      expect(outcome.stdout).not.toContain('no longer reported')
    })

    it('does not let an accepted id cover another module', () => {
      const outcome = evaluateAuditResult(moderateAudit([{ ...glob, module: 'minimatch' }]), {
        accepted: accepted([{ id: glob.id, module: 'glob', reviewBy: '2027-02-14' }]),
        today: '2026-11-14',
      })

      expect(outcome.exitCode).toBe(1)
      expect(outcome.stderr).toContain('minimatch (moderate)')
    })

    it('fails when an accepted advisory is past its review date', () => {
      const outcome = evaluateAuditResult(moderateAudit([glob]), {
        accepted: accepted([{ id: glob.id, module: 'glob', reviewBy: '2026-11-13' }]),
        today: '2026-11-14',
      })

      expect(outcome.exitCode).toBe(1)
      expect(outcome.stderr).toContain('past their review date')
      expect(outcome.stderr).toContain('review by 2026-11-13')
    })

    it('reports accepted entries that are no longer in the audit without failing', () => {
      const outcome = evaluateAuditResult(moderateAudit([glob]), {
        accepted: accepted([
          { id: glob.id, module: 'glob', reviewBy: '2027-02-14' },
          { id: quill.id, module: 'quill', reviewBy: '2020-01-01' },
        ]),
        today: '2026-11-14',
      })

      expect(outcome.exitCode).toBe(0)
      expect(outcome.stdout).toContain('no longer reported, remove them')
      expect(outcome.stdout).toContain('GHSA-V3M3-F69X-JF25 quill')
    })

    it('fails closed on an advisory without an identifier and on a broken accepted file', () => {
      const anonymous = evaluateAuditResult(moderateAudit([{ module: 'glob', severity: 'moderate' }]), {
        accepted: accepted([]),
        today: '2026-11-14',
      })
      expect(anonymous.stderr).toContain('FAILED CLOSED (audit advisory without an identifier)')

      const broken = evaluateAuditResult(moderateAudit([glob]), {
        accepted: parseAcceptedAdvisories('{"accepted":[{"id":"GHSA-3g3m-2fjr-6pw4","module":"glob","reviewBy":"soon","reason":"x"}]}'),
        today: '2026-11-14',
      })
      expect(broken.exitCode).toBe(1)
      expect(broken.stderr).toContain('FAILED CLOSED (accepted advisory #1 needs id, module, reviewBy')
      expect(accepted([{ id: glob.id, module: 'glob', reviewBy: '2027-02-30' }]).error).toContain('needs id, module, reviewBy')
      expect(parseAcceptedAdvisories('not json').error).toContain('not valid JSON')
      expect(parseAcceptedAdvisories('{}').error).toContain('no "accepted" array')
      expect(accepted([
        { id: glob.id, module: 'glob', reviewBy: '2027-02-14' },
        { id: glob.id, module: 'glob', reviewBy: '2027-02-14' },
      ]).error).toContain('listed twice')
    })

    it('keeps the committed accepted list valid and unexpired entries dated', () => {
      const committed = loadAcceptedAdvisories()

      expect(committed.error).toBeUndefined()
      expect(committed.entries.size).toBeGreaterThan(0)
      expect(loadAcceptedAdvisories('/nonexistent/yarn-audit-accepted.json').error).toContain('missing or unreadable')
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
