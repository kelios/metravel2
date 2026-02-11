const {
  evaluateGuard,
  parseOverrideReason,
} = require('@/scripts/guard-quality-schema-change');

describe('guard-quality-schema-change', () => {
  it('passes when schema files are unchanged', () => {
    const result = evaluateGuard({
      changedFiles: ['README.md'],
      prBody: '',
    });
    expect(result.ok).toBe(true);
  });

  it('fails when summarize schema file changes without companion test/docs', () => {
    const result = evaluateGuard({
      changedFiles: ['scripts/summarize-quality-gate.js'],
      prBody: '',
    });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('__tests__/scripts/summarize-quality-gate.test.ts');
    expect(result.missing).toContain('docs/TESTING.md');
  });

  it('fails when selective decision validator changes without companion test/docs', () => {
    const result = evaluateGuard({
      changedFiles: ['scripts/validate-selective-decision.js'],
      prBody: '',
    });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('__tests__/scripts/validate-selective-decision.test.ts');
    expect(result.missing).toContain('docs/TESTING.md');
  });

  it('passes when schema changes include required tests and docs', () => {
    const result = evaluateGuard({
      changedFiles: [
        'scripts/summarize-quality-gate.js',
        '__tests__/scripts/summarize-quality-gate.test.ts',
        'docs/TESTING.md',
      ],
      prBody: '',
    });
    expect(result.ok).toBe(true);
  });

  it('passes when override is present in PR body', () => {
    const result = evaluateGuard({
      changedFiles: ['scripts/validate-quality-summary.js'],
      prBody: 'schema-guard: skip - emergency patch, docs in follow-up PR',
    });
    expect(result.ok).toBe(true);
    expect(result.reason).toContain('override');
  });

  it('parses override reason', () => {
    const reason = parseOverrideReason('Text\nschema-guard: skip - justified exception\nMore');
    expect(reason).toBe('justified exception');
  });
});
