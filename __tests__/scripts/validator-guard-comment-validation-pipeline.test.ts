const { validateDetailed } = require('@/scripts/validate-validator-guard-comment')
const { buildResult } = require('@/scripts/validator-output')
const { buildSummaryLines } = require('@/scripts/summarize-validator-guard-comment-validation')

describe('validator guard comment validation pipeline integration', () => {
  it('keeps fail payload and summary consistent for invalid markdown', () => {
    const markdown = [
      '### Validator Guard Comment',
      '- Status: UNKNOWN',
      '- Reason: <fill>',
      '- Workflow run: not-a-url',
      '- Guard artifact: <link>',
      '',
    ].join('\n')

    const result = buildResult({
      file: 'test-results/validator-guard-comment-publish.md',
      errors: validateDetailed(markdown),
    })
    const summary = buildSummaryLines({
      file: 'test-results/validator-guard-comment-validation.json',
      payload: result,
      missing: false,
      parseError: '',
    }).join('\n')

    expect(result.ok).toBe(false)
    expect(result.errorCount).toBeGreaterThan(0)
    expect(summary).toContain('Status: fail')
    expect(summary).toContain(`Error count: ${result.errorCount}`)
    expect(summary).toContain('VALIDATOR_GUARD_COMMENT_INVALID_STATUS')
  })

  it('keeps pass payload and summary consistent for valid markdown', () => {
    const markdown = [
      '<!-- validator-guard-comment -->',
      '### Validator Guard Comment',
      '',
      '- Status: PASS',
      '- Reason: Guard checks passed.',
      '- Workflow run: https://github.com/org/repo/actions/runs/123',
      '- Guard artifact: https://github.com/org/repo/actions/runs/123#artifacts',
      '',
    ].join('\n')

    const result = buildResult({
      file: 'test-results/validator-guard-comment-publish.md',
      errors: validateDetailed(markdown),
    })
    const summary = buildSummaryLines({
      file: 'test-results/validator-guard-comment-validation.json',
      payload: result,
      missing: false,
      parseError: '',
    }).join('\n')

    expect(result.ok).toBe(true)
    expect(result.errorCount).toBe(0)
    expect(summary).toContain('Status: pass')
    expect(summary).toContain('Error count: 0')
  })
})
