const {
  parseArgs,
  buildIncidentMarkdown,
} = require('@/scripts/generate-ci-incident');

describe('generate-ci-incident script', () => {
  it('parses cli args with --key value pairs', () => {
    const parsed = parseArgs([
      '--failure-class', 'smoke_only',
      '--recommendation-id', 'QG-004',
      '--owner', 'Platform Team',
    ]);
    expect(parsed['failure-class']).toBe('smoke_only');
    expect(parsed['recommendation-id']).toBe('QG-004');
    expect(parsed.owner).toBe('Platform Team');
  });

  it('builds markdown with provided values', () => {
    const md = buildIncidentMarkdown({
      dateUtc: '2026-02-11 20:10',
      workflowRun: 'https://example.com/run/1',
      branchOrPr: 'https://example.com/pull/42',
      failureClass: 'inconsistent_state',
      recommendationId: 'QG-002',
      impact: 'Merge blocked',
      owner: 'CI Team',
      eta: '2026-02-12 12:00 UTC',
      immediateAction: 'Reran failed workflow',
      followUp: 'yes - add artifact diagnostics',
      selectiveArtifact: 'https://example.com/run/1#artifacts',
      validatorArtifact: 'https://example.com/run/1/artifacts/789',
    });

    expect(md).toContain('### CI Smoke Incident');
    expect(md).toContain('- Failure Class: inconsistent_state');
    expect(md).toContain('- Recommendation ID: QG-002');
    expect(md).toContain('- Owner: CI Team');
    expect(md).toContain('- Selective decisions artifact: https://example.com/run/1#artifacts');
    expect(md).toContain('- Validator contracts artifact: https://example.com/run/1/artifacts/789');
  });

  it('uses placeholders when values are not provided', () => {
    const md = buildIncidentMarkdown({});
    expect(md).toContain('- Workflow run: <link>');
    expect(md).toContain('- Recommendation ID: <QG-001..QG-008>');
    expect(md).toContain('selective_contract');
    expect(md).toContain('validator_contract');
    expect(md).toContain('- Owner: <person-or-team>');
  });
});
