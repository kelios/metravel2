const fs = require('fs')
const path = require('path')
const { runNodeCli, makeTempDir, writeTextFile } = require('./cli-test-utils')
const {
  parseArgs,
  getLintTargets,
  runFastScopeChecks,
} = require('@/scripts/run-fast-scope-checks')

describe('run-fast-scope-checks', () => {
  it('parses supported args', () => {
    expect(parseArgs([])).toEqual({
      baseRef: '',
      changedFilesFile: '',
      dryRun: false,
      output: 'text',
    })

    expect(parseArgs([
      '--base-ref', 'origin/main',
      '--changed-files-file', 'tmp/changed.txt',
      '--dry-run',
      '--json',
    ])).toEqual({
      baseRef: 'origin/main',
      changedFilesFile: 'tmp/changed.txt',
      dryRun: true,
      output: 'json',
    })
  })

  it('keeps lint scope on changed source files only', () => {
    expect(getLintTargets([
      'docs/TESTING.md',
      'scripts/run-fast-scope-checks.js',
      'components/Button.tsx',
      'package.json',
    ])).toEqual([
      'scripts/run-fast-scope-checks.js',
      'components/Button.tsx',
    ])
  })

  it('builds fast check plan from changed files', () => {
    const result = runFastScopeChecks({
      changedFiles: ['docs/TESTING.md', 'scripts/validator-output.js'],
      dryRun: true,
      output: 'json',
    })

    expect(result.lintTargets).toEqual(['scripts/validator-output.js'])
    expect(result.selectiveChecks).toHaveLength(2)
  })

  it('emits combined dry-run json payload', () => {
    const dir = makeTempDir('fast-scope-checks-cli-')
    const changedFilesFile = path.join(dir, 'changed.txt')
    writeTextFile(changedFilesFile, 'docs/TESTING.md\nscripts/validator-output.js\n')

    const result = runNodeCli([
      'scripts/run-fast-scope-checks.js',
      '--changed-files-file', changedFilesFile,
      '--dry-run',
      '--json',
    ])

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')

    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.source).toBe('file')
    expect(payload.changedFiles).toEqual(['docs/TESTING.md', 'scripts/validator-output.js'])
    expect(payload.lintTargets).toEqual(['scripts/validator-output.js'])
    expect(payload.checks.map((item) => item.check)).toEqual([
      'schema-contract-checks',
      'validator-contract-checks',
    ])

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('rejects json output without dry-run', () => {
    const result = runNodeCli([
      'scripts/run-fast-scope-checks.js',
      '--json',
    ])

    expect(result.status).toBe(2)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('--json is supported only with --dry-run')
  })
})
