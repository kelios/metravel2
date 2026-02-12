const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const {
  parseArgs,
  buildSummaryLines,
} = require('@/scripts/summarize-validator-guard')

describe('summarize-validator-guard', () => {
  it('parses args with defaults and overrides', () => {
    expect(parseArgs([])).toEqual({
      file: 'test-results/validator-guard.json',
      stepSummaryPath: '',
    })
    expect(parseArgs(['--file', 'tmp/a.json', '--step-summary-path', 'tmp/summary.md'])).toEqual({
      file: 'tmp/a.json',
      stepSummaryPath: 'tmp/summary.md',
    })
  })

  it('builds summary lines for guard payload', () => {
    const lines = buildSummaryLines({
      file: 'test-results/validator-guard.json',
      payload: {
        ok: false,
        reason: 'Guard failed',
        touchedCount: 1,
        missingCount: 2,
        hintCount: 1,
        hints: ['Expected summary companion test for scripts/summarize-x.js: __tests__/scripts/summarize-x.test.ts'],
      },
      missing: false,
      parseError: '',
    })

    expect(lines.join('\n')).toContain('### Validator Guard Summary')
    expect(lines.join('\n')).toContain('- Missing companions: 2')
    expect(lines.join('\n')).toContain('Top hints')
  })

  it('writes summary to GITHUB_STEP_SUMMARY in cli mode', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'summarize-validator-guard-'))
    const payloadPath = path.join(dir, 'validator-guard.json')
    const stepSummaryPath = path.join(dir, 'step-summary.md')

    fs.writeFileSync(payloadPath, JSON.stringify({
      contractVersion: 1,
      ok: false,
      reason: 'Guard failed',
      touchedCount: 1,
      missingCount: 1,
      hintCount: 1,
      missing: ['__tests__/scripts/summarize-jest-smoke.test.ts'],
      hints: ['Expected summary companion test for scripts/summarize-jest-smoke.js: __tests__/scripts/summarize-jest-smoke.test.ts'],
    }), 'utf8')

    const result = spawnSync(process.execPath, [
      'scripts/summarize-validator-guard.js',
      '--file',
      payloadPath,
    ], {
      cwd: process.cwd(),
      env: { ...process.env, GITHUB_STEP_SUMMARY: stepSummaryPath },
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Validator Guard Summary')
    const markdown = fs.readFileSync(stepSummaryPath, 'utf8')
    expect(markdown).toContain('- Missing companions: 1')
    expect(markdown).toContain('Expected summary companion test')

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
