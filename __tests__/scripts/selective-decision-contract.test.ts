const { validateSelectiveDecision } = require('@/scripts/selective-decision-contract')

describe('selective-decision-contract', () => {
  it('accepts valid decision payload', () => {
    expect(validateSelectiveDecision({
      contractVersion: 1,
      check: 'schema-contract-checks',
      decision: 'run',
      shouldRun: true,
      reason: 'match',
      changedFilesScanned: 12,
      relevantMatches: 2,
      matchedFiles: ['scripts/validate-quality-summary.js'],
      dryRun: true,
      targetedTests: 3,
    })).toEqual([])
  })

  it('returns schema errors for malformed payload', () => {
    const errors = validateSelectiveDecision({
      contractVersion: 2,
      check: '',
      decision: 'maybe',
      shouldRun: 'yes',
      reason: '',
      changedFilesScanned: '12',
      relevantMatches: null,
      matchedFiles: [1],
      dryRun: 'true',
      targetedTests: '3',
    })

    expect(errors.join('\n')).toContain('contractVersion')
    expect(errors.join('\n')).toContain('decision')
    expect(errors.join('\n')).toContain('matchedFiles')
  })
})
