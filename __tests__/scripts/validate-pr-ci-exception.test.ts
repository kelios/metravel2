const {
  parseArgs,
  validateExceptionDetailed,
  validateException,
} = require('@/scripts/validate-pr-ci-exception');

const bodyWithException = `
## CI Exception (Only if Failure Class != pass)

- [x] Exception requested
- Business reason: Critical customer hotfix before event.
- Risk statement: May increase smoke runtime by up to 20%.
- Rollback plan: Revert commit and redeploy previous image.
- Owner: Platform Team
- Fix deadline (YYYY-MM-DD): 2026-02-20
`;

describe('validate-pr-ci-exception script', () => {
  it('parses json output flag', () => {
    expect(parseArgs([])).toEqual({ output: 'text' });
    expect(parseArgs(['--json'])).toEqual({ output: 'json' });
  });

  it('passes when exception is not required and not requested', () => {
    const result = validateException({
      body: 'Regular PR body',
      requireException: false,
    });
    expect(result.valid).toBe(true);
    expect(result.requested).toBe(false);
  });

  it('fails when exception is required but checkbox is not checked', () => {
    const result = validateException({
      body: 'Regular PR body',
      requireException: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('Exception is required');
  });

  it('passes when exception is requested with all required fields', () => {
    const result = validateException({
      body: bodyWithException,
      requireException: true,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when exception is requested but required fields are placeholders', () => {
    const body = `
    - [x] Exception requested
    - Business reason: TBD
    - Risk statement: -
    - Rollback plan:
    - Owner: [owner]
    - Fix deadline (YYYY-MM-DD): <date>
    `;
    const result = validateException({
      body,
      requireException: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    expect(result.errors.join('\n')).toContain('Business reason');
    expect(result.errors.join('\n')).toContain('Fix deadline');
  });

  it('returns structured detailed errors', () => {
    const result = validateExceptionDetailed({
      body: 'Regular PR body',
      requireException: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toHaveProperty('code');
    expect(result.errors[0]).toHaveProperty('field');
    expect(result.errors[0]).toHaveProperty('message');
  });
});
