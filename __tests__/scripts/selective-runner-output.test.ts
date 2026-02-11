const {
  SELECTIVE_RUNNER_CONTRACT_VERSION,
  buildSelectiveDecision,
} = require('@/scripts/selective-runner-output')

describe('selective-runner-output', () => {
  it('builds normalized selective decision payload', () => {
    const payload = buildSelectiveDecision({
      check: 'schema-contract-checks',
      decision: 'run',
      reason: 'match',
      changedFiles: ['scripts/validate-quality-summary.js'],
      matchedFiles: ['scripts/validate-quality-summary.js'],
      dryRun: true,
      targetedTests: 3,
    })

    expect(payload).toEqual({
      contractVersion: SELECTIVE_RUNNER_CONTRACT_VERSION,
      check: 'schema-contract-checks',
      decision: 'run',
      shouldRun: true,
      reason: 'match',
      changedFilesScanned: 1,
      relevantMatches: 1,
      matchedFiles: ['scripts/validate-quality-summary.js'],
      dryRun: true,
      targetedTests: 3,
    })
  })
})
