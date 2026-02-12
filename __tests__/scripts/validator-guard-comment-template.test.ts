const {
  COMMENT_MARKER,
  COMMENT_HEADER,
  buildFallbackComment,
} = require('@/scripts/validator-guard-comment-template')

describe('validator-guard-comment-template', () => {
  it('builds fallback comment with required contract lines', () => {
    const markdown = buildFallbackComment({
      runUrl: 'https://github.com/org/repo/actions/runs/123',
      artifactUrl: 'https://github.com/org/repo/actions/runs/123#artifacts',
    })

    expect(markdown).toContain(COMMENT_MARKER)
    expect(markdown).toContain(COMMENT_HEADER)
    expect(markdown).toContain('Status: FAIL')
    expect(markdown).toContain('Reason: Unable to load generated guard comment preview.')
    expect(markdown).toContain('Workflow run: https://github.com/org/repo/actions/runs/123')
    expect(markdown).toContain('Guard artifact: https://github.com/org/repo/actions/runs/123#artifacts')
  })

  it('supports custom reason and optional links', () => {
    const markdown = buildFallbackComment({
      reason: 'Custom fallback reason',
      runUrl: '',
      artifactUrl: '',
    })

    expect(markdown).toContain('Reason: Custom fallback reason')
    expect(markdown).not.toContain('Workflow run:')
    expect(markdown).not.toContain('Guard artifact:')
  })
})
