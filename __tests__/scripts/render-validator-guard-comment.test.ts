const fs = require('fs')
const os = require('os')
const path = require('path')
const { runNodeCli, writeJsonFile } = require('./cli-test-utils')
const {
  parseArgs,
  buildCommentMarkdown,
  COMMENT_MARKER,
} = require('@/scripts/render-validator-guard-comment')

describe('render-validator-guard-comment', () => {
  it('parses args with defaults and overrides', () => {
    expect(parseArgs([])).toEqual({
      file: 'test-results/validator-guard.json',
      outputFile: 'test-results/validator-guard-comment.md',
      runUrl: '',
      artifactUrl: '',
      qualitySummaryUrl: '',
      commentArtifactUrl: '',
      output: 'text',
    })
    expect(parseArgs(['--file', 'a.json', '--output-file', 'b.md', '--run-url', 'https://example.com/run/1', '--artifact-url', 'https://example.com/artifacts/2', '--quality-summary-url', 'https://example.com/artifacts/quality-summary', '--comment-artifact-url', 'https://example.com/artifacts/comment', '--json'])).toEqual({
      file: 'a.json',
      outputFile: 'b.md',
      runUrl: 'https://example.com/run/1',
      artifactUrl: 'https://example.com/artifacts/2',
      qualitySummaryUrl: 'https://example.com/artifacts/quality-summary',
      commentArtifactUrl: 'https://example.com/artifacts/comment',
      output: 'json',
    })
  })

  it('builds markdown for failing guard payload', () => {
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
      qualitySummaryUrl: 'https://github.com/org/repo/actions/runs/123#artifacts',
      commentArtifactUrl: 'https://github.com/org/repo/actions/runs/123/artifacts/789',
    })
    expect(markdown).toContain(COMMENT_MARKER)
    expect(markdown).toContain('Status: FAIL')
    expect(markdown).toContain('Workflow run: https://github.com/org/repo/actions/runs/123')
    expect(markdown).toContain('Guard artifact: https://github.com/org/repo/actions/runs/123#artifacts')
    expect(markdown).toContain('Quality summary artifact: https://github.com/org/repo/actions/runs/123#artifacts')
    expect(markdown).toContain('Guard comment artifact: https://github.com/org/repo/actions/runs/123/artifacts/789')
    expect(markdown).toContain('Missing required files')
    expect(markdown).toContain('Expected summary companion test')
  })

  it('builds markdown for passing guard payload', () => {
    const markdown = buildCommentMarkdown({
      file: 'test-results/validator-guard.json',
      payload: {
        ok: true,
        reason: 'Guard checks passed.',
        touchedFiles: [],
        missing: [],
        hints: [],
      },
      missing: false,
      parseError: '',
      runUrl: 'https://github.com/org/repo/actions/runs/123',
      artifactUrl: 'https://github.com/org/repo/actions/runs/123#artifacts',
      qualitySummaryUrl: 'https://github.com/org/repo/actions/runs/123#artifacts',
      commentArtifactUrl: 'https://github.com/org/repo/actions/runs/123/artifacts/789',
    })
    expect(markdown).toContain('Status: PASS')
    expect(markdown).toContain('Workflow run: https://github.com/org/repo/actions/runs/123')
    expect(markdown).toContain('Guard artifact: https://github.com/org/repo/actions/runs/123#artifacts')
    expect(markdown).toContain('Quality summary artifact: https://github.com/org/repo/actions/runs/123#artifacts')
    expect(markdown).toContain('Guard comment artifact: https://github.com/org/repo/actions/runs/123/artifacts/789')
    expect(markdown).not.toContain('Missing required files')
  })

  it('writes markdown file and returns json payload in cli mode', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-validator-guard-'))
    const inputFile = path.join(dir, 'validator-guard.json')
    const outputFile = path.join(dir, 'validator-guard-comment.md')

    writeJsonFile(inputFile, {
      contractVersion: 1,
      ok: false,
      reason: 'Guard failed',
      touchedFiles: ['scripts/summarize-jest-smoke.js'],
      missing: ['__tests__/scripts/summarize-jest-smoke.test.ts'],
      hints: ['Expected summary companion test for scripts/summarize-jest-smoke.js: __tests__/scripts/summarize-jest-smoke.test.ts'],
    })

    const result = runNodeCli([
      'scripts/render-validator-guard-comment.js',
      '--file',
      inputFile,
      '--output-file',
      outputFile,
      '--run-url',
      'https://github.com/org/repo/actions/runs/123',
      '--artifact-url',
      'https://github.com/org/repo/actions/runs/123#artifacts',
      '--quality-summary-url',
      'https://github.com/org/repo/actions/runs/123#artifacts',
      '--comment-artifact-url',
      'https://github.com/org/repo/actions/runs/123/artifacts/789',
      '--json',
    ])

    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.outputFile).toBe(outputFile)
    expect(payload.markdown).toContain(COMMENT_MARKER)
    expect(payload.markdown).toContain('Validator Guard Comment')
    expect(payload.markdown).toContain('Workflow run: https://github.com/org/repo/actions/runs/123')
    expect(payload.markdown).toContain('Quality summary artifact: https://github.com/org/repo/actions/runs/123#artifacts')
    expect(payload.markdown).toContain('Guard comment artifact: https://github.com/org/repo/actions/runs/123/artifacts/789')
    const markdown = fs.readFileSync(outputFile, 'utf8')
    expect(markdown).toContain('Missing required files')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('includes comment artifact link when input file is missing', () => {
    const markdown = buildCommentMarkdown({
      file: 'test-results/missing-validator-guard.json',
      payload: null,
      missing: true,
      parseError: '',
      runUrl: 'https://github.com/org/repo/actions/runs/123',
      artifactUrl: 'https://github.com/org/repo/actions/runs/123#artifacts',
      qualitySummaryUrl: 'https://github.com/org/repo/actions/runs/123/artifacts/456',
      commentArtifactUrl: 'https://github.com/org/repo/actions/runs/123/artifacts/789',
    })

    expect(markdown).toContain('Result file not found')
    expect(markdown).toContain('Guard comment artifact: https://github.com/org/repo/actions/runs/123/artifacts/789')
  })

  it('includes comment artifact link when input JSON is invalid', () => {
    const markdown = buildCommentMarkdown({
      file: 'test-results/validator-guard.json',
      payload: null,
      missing: false,
      parseError: 'Unexpected token',
      runUrl: 'https://github.com/org/repo/actions/runs/123',
      artifactUrl: 'https://github.com/org/repo/actions/runs/123#artifacts',
      qualitySummaryUrl: 'https://github.com/org/repo/actions/runs/123/artifacts/456',
      commentArtifactUrl: 'https://github.com/org/repo/actions/runs/123/artifacts/789',
    })

    expect(markdown).toContain('Failed to parse')
    expect(markdown).toContain('Guard comment artifact: https://github.com/org/repo/actions/runs/123/artifacts/789')
  })
})
