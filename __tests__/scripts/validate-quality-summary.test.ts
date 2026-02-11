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
    };
    const errors = validate(payload);
    expect(errors.join('\n')).toContain('Unsupported schemaVersion');
    expect(errors.join('\n')).toContain('recommendationId');
    expect(errors.join('\n')).toContain('inconsistencies');
  });
});
