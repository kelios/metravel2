const fs = require('fs')
const path = require('path')
const { runNodeCli, makeTempDir, writeTextFile } = require('./cli-test-utils')
const {
  CHECKS,
  parseArgs,
  normalizeFileList,
  parseLineList,
  resolveChangedFilesInput,
} = require('@/scripts/run-local-selective-checks')

describe('run-local-selective-checks', () => {
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

  it('normalizes and sorts changed files', () => {
    expect(normalizeFileList(['b', 'a', 'b', ''])).toEqual(['a', 'b'])
    expect(parseLineList('one\n two \n\n')).toEqual(['one', 'two'])
  })

  it('reads changed files from explicit file input', () => {
    const dir = makeTempDir('local-selective-checks-')
    const changedFilesFile = path.join(dir, 'changed.txt')
    writeTextFile(changedFilesFile, 'scripts/validator-output.js\nREADME.md\n')

    expect(resolveChangedFilesInput({ changedFilesFile })).toEqual({
      files: ['README.md', 'scripts/validator-output.js'],
      source: 'file',
    })

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('runs both selective checks in dry-run json mode', () => {
    const dir = makeTempDir('local-selective-checks-cli-')
    const changedFilesFile = path.join(dir, 'changed.txt')
    writeTextFile(changedFilesFile, 'scripts/validator-output.js\nREADME.md\n')

    const result = runNodeCli([
      'scripts/run-local-selective-checks.js',
      '--changed-files-file', changedFilesFile,
      '--dry-run',
      '--json',
    ])

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')

    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.source).toBe('file')
    expect(payload.changedFilesScanned).toBe(2)
    expect(payload.changedFiles).toEqual(['README.md', 'scripts/validator-output.js'])
    expect(payload.checks).toHaveLength(CHECKS.length)
    expect(payload.checks.map((item) => item.check)).toEqual([
      'schema-contract-checks',
      'validator-contract-checks',
    ])

    const schema = payload.checks.find((item) => item.check === 'schema-contract-checks')
    const validator = payload.checks.find((item) => item.check === 'validator-contract-checks')
    expect(schema.decision).toBe('skip')
    expect(validator.decision).toBe('run')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('rejects json output without dry-run', () => {
    const result = runNodeCli([
      'scripts/run-local-selective-checks.js',
      '--json',
    ])

    expect(result.status).toBe(2)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('--json is supported only with --dry-run')
  })
})
