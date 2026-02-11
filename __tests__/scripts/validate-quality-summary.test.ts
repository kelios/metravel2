const {
  validate,
  SUPPORTED_SCHEMA_VERSION,
} = require('@/scripts/validate-quality-summary');

describe('validate-quality-summary schema checks', () => {
  const basePayload = {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    overallOk: true,
    failureClass: 'pass',
    recommendationId: null,
    lintOk: true,
    smokeOk: true,
    lintJobResult: 'success',
    smokeJobResult: 'success',
    smokeDurationSeconds: 3.5,
    smokeDurationBudgetSeconds: 30,
    smokeDurationOverBudget: false,
    budgetBlocking: false,
    inconsistencies: [],
    smokeSuiteFiles: ['__tests__/app/export.test.tsx'],
    smokeSuiteBaselineProvided: true,
    smokeSuiteAddedFiles: ['__tests__/app/export.test.tsx'],
    smokeSuiteRemovedFiles: [],
    selectiveDecisions: [
      {
        contractVersion: 1,
        check: 'schema-contract-checks',
        decision: 'run',
        shouldRun: true,
        reason: 'match',
        changedFilesScanned: 10,
        relevantMatches: 2,
        matchedFiles: ['scripts/validate-quality-summary.js'],
        dryRun: true,
        targetedTests: 3,
      },
    ],
    selectiveDecisionWarnings: [],
  };

  it('passes for valid payload', () => {
    expect(validate(basePayload)).toEqual([]);
  });

  it('fails when required fields are missing', () => {
    const errors = validate({});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).toContain('failureClass');
    expect(errors.join('\n')).toContain('overallOk');
  });

  it('fails on invalid field types', () => {
    const payload = {
      ...basePayload,
      schemaVersion: 999,
      recommendationId: 42,
      inconsistencies: [1, 2],
      smokeSuiteFiles: [123],
      smokeSuiteBaselineProvided: 'yes',
      smokeSuiteAddedFiles: [123],
      smokeSuiteRemovedFiles: [false],
      selectiveDecisions: [{
        contractVersion: 2,
        check: '',
        decision: 'maybe',
        shouldRun: 'yes',
        reason: '',
        changedFilesScanned: '10',
        relevantMatches: null,
        matchedFiles: [1],
        dryRun: 'true',
        targetedTests: '3',
      }],
      selectiveDecisionWarnings: [1],
    };
    const errors = validate(payload);
    expect(errors.join('\n')).toContain('Unsupported schemaVersion');
    expect(errors.join('\n')).toContain('recommendationId');
    expect(errors.join('\n')).toContain('inconsistencies');
    expect(errors.join('\n')).toContain('smokeSuiteFiles');
    expect(errors.join('\n')).toContain('smokeSuiteBaselineProvided');
    expect(errors.join('\n')).toContain('smokeSuiteAddedFiles');
    expect(errors.join('\n')).toContain('smokeSuiteRemovedFiles');
    expect(errors.join('\n')).toContain('selectiveDecisionWarnings');
    expect(errors.join('\n')).toContain('selectiveDecisions[0].contractVersion');
    expect(errors.join('\n')).toContain('selectiveDecisions[0].decision');
  });
});
