const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  parseArgs,
  extractLineValue,
  isPlaceholder,
  validate,
  validateDetailed,
} = require('@/scripts/validate-ci-incident-snippet')

describe('validate-ci-incident-snippet', () => {
  it('parses default and override file args', () => {
    expect(parseArgs([])).toEqual({
      file: 'test-results/ci-incident-snippet.md',
      output: 'text',
    })
    expect(parseArgs(['--file', 'tmp/incident.md'])).toEqual({
      file: 'tmp/incident.md',
      output: 'text',
    })
    expect(parseArgs(['--json'])).toEqual({
      file: 'test-results/ci-incident-snippet.md',
      output: 'json',
    })
  })

  it('extracts markdown line values by label', () => {
    const markdown = '- Failure Class: smoke_only\n- Recommendation ID: QG-004\n'
    expect(extractLineValue(markdown, 'Failure Class')).toBe('smoke_only')
    expect(extractLineValue(markdown, 'Recommendation ID')).toBe('QG-004')
  })

  it('detects placeholders', () => {
    expect(isPlaceholder('<fill>')).toBe(true)
    expect(isPlaceholder('[todo]')).toBe(true)
    expect(isPlaceholder('')).toBe(true)
    expect(isPlaceholder('QG-004')).toBe(false)
  })

  it('passes for valid incident markdown', () => {
    const markdown = [
      '### CI Smoke Incident',
      '- Date (UTC): 2026-02-11 20:10',
      '- Workflow run: https://example.com/run/1',
      '- Branch / PR: https://example.com/pull/42',
      '- Failure Class: smoke_only',
      '- Recommendation ID: QG-004',
      '- Impact: <fill>',
      '- Owner: <fill>',
      '- ETA: <fill>',
      '- Immediate action taken: Initial triage started',
      '- Follow-up required: yes',
      '',
    ].join('\n')

    expect(validate(markdown)).toEqual([])
  })

  it('accepts selective_contract failure class', () => {
    const markdown = [
      '### CI Smoke Incident',
      '- Date (UTC): 2026-02-11 20:10',
      '- Workflow run: https://example.com/run/1',
      '- Branch / PR: https://example.com/pull/42',
      '- Failure Class: selective_contract',
      '- Recommendation ID: QG-007',
      '- Follow-up required: yes; inspect selective-decisions artifact (test-results/selective-decisions.json)',
      '',
    ].join('\n')

    expect(validate(markdown)).toEqual([])
  })

  it('fails selective_contract incidents when selective reference is missing', () => {
    const markdown = [
      '### CI Smoke Incident',
      '- Date (UTC): 2026-02-11 20:10',
      '- Workflow run: https://example.com/run/1',
      '- Branch / PR: https://example.com/pull/42',
      '- Failure Class: selective_contract',
      '- Recommendation ID: QG-007',
      '- Follow-up required: yes',
      '',
    ].join('\n')

    const errors = validateDetailed(markdown)
    expect(errors.some((entry) => entry.code === 'INCIDENT_MISSING_SELECTIVE_REFERENCE')).toBe(true)
  })

  it('accepts selective_contract incidents when artifact line is present', () => {
    const markdown = [
      '### CI Smoke Incident',
      '- Date (UTC): 2026-02-11 20:10',
      '- Workflow run: https://example.com/run/1',
      '- Branch / PR: https://example.com/pull/42',
      '- Failure Class: selective_contract',
      '- Recommendation ID: QG-007',
      '- Follow-up required: yes',
      '- Selective decisions artifact: https://github.com/org/repo/actions/runs/123/artifacts/456',
      '',
    ].join('\n')

    expect(validate(markdown)).toEqual([])
  })

  it('fails for placeholder/invalid required auto fields', () => {
    const markdown = [
      '### CI Smoke Incident',
      '- Date (UTC): 2026-02-11 20:10',
      '- Workflow run: <link>',
      '- Branch / PR: <branch-or-pr-link>',
      '- Failure Class: unknown',
      '- Recommendation ID: <from Quality Gate Summary>',
      '',
    ].join('\n')

    const errors = validate(markdown)
    expect(errors.join('\n')).toContain('Workflow run')
    expect(errors.join('\n')).toContain('Branch / PR')
    expect(errors.join('\n')).toContain('Failure Class')
    expect(errors.join('\n')).toContain('Recommendation ID')
  })

  it('returns machine-readable detailed errors', () => {
    const markdown = [
      '- Workflow run: <link>',
      '- Branch / PR: <branch-or-pr-link>',
      '- Failure Class: unknown',
      '- Recommendation ID: <from Quality Gate Summary>',
      '',
    ].join('\n')
    const detailed = validateDetailed(markdown)
    expect(detailed.length).toBeGreaterThan(0)
    expect(detailed[0]).toHaveProperty('code')
    expect(detailed[0]).toHaveProperty('field')
    expect(detailed[0]).toHaveProperty('message')
  })

  it('reads and validates file content', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-incident-'))
    const filePath = path.join(dir, 'incident.md')
    fs.writeFileSync(filePath, [
      '### CI Smoke Incident',
      '- Workflow run: https://example.com/run/1',
      '- Branch / PR: https://example.com/pull/42',
      '- Failure Class: mixed',
      '- Recommendation ID: QG-005',
      '',
    ].join('\n'), 'utf8')

    const content = fs.readFileSync(filePath, 'utf8')
    expect(validate(content)).toEqual([])
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
