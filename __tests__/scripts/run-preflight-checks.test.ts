const fs = require('fs')
const path = require('path')
const { runNodeCli, makeTempDir, writeTextFile } = require('./cli-test-utils')
const {
  CHECKS,
  parseArgs,
  buildRunnerArgs,
  createChangedFilesTempInput,
  removeTempInput,
} = require('@/scripts/run-preflight-checks')

describe('run-preflight-checks', () => {
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

  it('builds downstream runner args with shared changed-files input', () => {
    expect(buildRunnerArgs({
      scriptPath: 'scripts/run-fast-scope-checks.js',
      changedFilesFile: '/tmp/changed.txt',
      dryRun: true,
      output: 'json',
    })).toEqual([
      'scripts/run-fast-scope-checks.js',
      '--changed-files-file',
      '/tmp/changed.txt',
      '--dry-run',
      '--json',
    ])
  })

  it('writes and cleans up a temp changed-files file', () => {
    const tempInput = createChangedFilesTempInput(['README.md', 'components/messages/ChatView.tsx'])

    expect(fs.existsSync(tempInput.filePath)).toBe(true)
    expect(fs.readFileSync(tempInput.filePath, 'utf8')).toBe('README.md\ncomponents/messages/ChatView.tsx\n')

    removeTempInput(tempInput)
    expect(fs.existsSync(tempInput.dir)).toBe(false)
  })

  it('emits combined dry-run json payload with shared downstream scope', () => {
    const dir = makeTempDir('preflight-checks-')
    const changedFilesFile = path.join(dir, 'changed.txt')
    writeTextFile(changedFilesFile, 'components/messages/ChatView.tsx\n')

    const result = runNodeCli([
      'scripts/run-preflight-checks.js',
      '--changed-files-file', changedFilesFile,
      '--dry-run',
      '--json',
    ])

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')

    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.check).toBe('preflight-checks')
    expect(payload.source).toBe('file')
    expect(payload.changedFiles).toEqual(['components/messages/ChatView.tsx'])
    expect(payload.checks).toHaveLength(CHECKS.length)
    expect(payload.checks.map((item) => item.name)).toEqual([
      'fast-scope-checks',
      'guard-file-complexity-changed',
      'e2e-changed',
    ])

    const e2e = payload.checks.find((item) => item.name === 'e2e-changed')
    expect(e2e.payload.check).toBe('e2e-changed')
    expect(e2e.payload.reason).toBe('match')
    expect(e2e.payload.matchedCategories).toEqual(['messages'])
    expect(e2e.payload.specs).toEqual(['e2e/messages.spec.ts'])

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('rejects json output without dry-run', () => {
    const result = runNodeCli([
      'scripts/run-preflight-checks.js',
      '--json',
    ])

    expect(result.status).toBe(2)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('--json is supported only with --dry-run')
  })
})

