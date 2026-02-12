const { buildCommentMarkdown } = require('@/scripts/render-validator-guard-comment')
const { buildFallbackComment } = require('@/scripts/validator-guard-comment-template')
const { validate } = require('@/scripts/validate-validator-guard-comment')

describe('validator guard comment pipeline integration', () => {
  it('keeps fallback path contract-valid when publish file is missing', () => {
    const fallbackMarkdown = buildFallbackComment({
      runUrl: 'https://github.com/org/repo/actions/runs/123',
      artifactUrl: 'https://github.com/org/repo/actions/runs/123#artifacts',
    })

    expect(validate(fallbackMarkdown)).toEqual([])
    expect(fallbackMarkdown).toContain('Status: FAIL')
    expect(fallbackMarkdown).toContain('Reason: Unable to load generated guard comment preview.')
  })

  it('keeps rendered publish body contract-valid for guard failures', () => {
    const markdown = buildCommentMarkdown({
      file: 'test-results/validator-guard.json',
      payload: {
        ok: false,
        reason: 'Guarded files changed without companions.',
        touchedFiles: ['scripts/summarize-jest-smoke.js'],
        missing: ['__tests__/scripts/summarize-jest-smoke.test.ts'],
        hints: ['Expected summary companion test for scripts/summarize-jest-smoke.js: __tests__/scripts/summarize-jest-smoke.test.ts'],
      },
      missing: false,
      parseError: '',
      runUrl: 'https://github.com/org/repo/actions/runs/123',
      artifactUrl: 'https://github.com/org/repo/actions/runs/123#artifacts',
      qualitySummaryUrl: 'https://github.com/org/repo/actions/runs/123/artifacts/456',
      commentArtifactUrl: 'https://github.com/org/repo/actions/runs/123/artifacts/789',
    })

    expect(validate(markdown)).toEqual([])
    expect(markdown).toContain('Status: FAIL')
    expect(markdown).toContain('Missing required files:')
  })
})
