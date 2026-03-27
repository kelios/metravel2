const fs = require('fs')
const path = require('path')
const { runNodeCli, makeTempDir, writeTextFile } = require('./cli-test-utils')
const {
  MAX_LOC,
  parseArgs,
  isScannedFile,
  getScannedChangedFiles,
  getGitTrackedFileLoc,
  scanChangedFiles,
} = require('@/scripts/guard-file-complexity-changed')

describe('guard-file-complexity-changed', () => {
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

  it('keeps scope on changed feature ts/tsx files only', () => {
    expect(isScannedFile('components/Foo.tsx')).toBe(true)
    expect(isScannedFile('services/bar.ts')).toBe(true)
    expect(isScannedFile('docs/TESTING.md')).toBe(false)
    expect(isScannedFile('scripts/tool.js')).toBe(false)

    expect(getScannedChangedFiles([
      'components/Foo.tsx',
      'docs/TESTING.md',
      'services/bar.ts',
      'scripts/tool.js',
    ])).toEqual([
      'components/Foo.tsx',
      'services/bar.ts',
    ])
  })

  it('detects LOC violations inside changed files only', () => {
    const dir = makeTempDir('guard-file-complexity-changed-')
    const oldCwd = process.cwd()
    try {
      process.chdir(dir)

      fs.mkdirSync(path.join(dir, 'components'), { recursive: true })
      writeTextFile(path.join(dir, 'components', 'Big.tsx'), `${Array.from({ length: MAX_LOC + 5 }, () => 'x').join('\n')}\n`)
      writeTextFile(path.join(dir, 'components', 'Small.tsx'), 'one\ntwo\n')

      const report = scanChangedFiles([
        'components/Big.tsx',
        'components/Small.tsx',
        'docs/IGNORED.md',
      ])

      expect(report.inspected.map((item) => item.file)).toEqual([
        'components/Big.tsx',
        'components/Small.tsx',
      ])
      expect(report.violations).toEqual([
        { file: 'components/Big.tsx', loc: MAX_LOC + 6, baselineLoc: null },
      ])
    } finally {
      process.chdir(oldCwd)
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('treats already oversized tracked files as non-blocking legacy touches', () => {
    const legacyOversizedFile = 'components/travel/StableContent.tsx'
    const baselineLoc = getGitTrackedFileLoc(legacyOversizedFile)
    expect(typeof baselineLoc).toBe('number')
    expect(Number(baselineLoc)).toBeGreaterThan(MAX_LOC)

    const report = scanChangedFiles([legacyOversizedFile])
    expect(report.violations).toEqual([])
    expect(report.legacyOversizedTouched).toEqual([
      expect.objectContaining({
        file: legacyOversizedFile,
        baselineLoc,
      }),
    ])
  })

  it('emits dry-run json payload', () => {
    const dir = makeTempDir('guard-file-complexity-changed-cli-')
    const changedFilesFile = path.join(dir, 'changed.txt')
    writeTextFile(changedFilesFile, 'docs/TESTING.md\nscripts/run-fast-scope-checks.js\n')

    const result = runNodeCli([
      'scripts/guard-file-complexity-changed.js',
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
    expect(payload.scannedFiles).toEqual([])
    expect(payload.violationCount).toBe(0)
    expect(payload.legacyOversizedTouched).toEqual([])

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('rejects json output without dry-run', () => {
    const result = runNodeCli([
      'scripts/guard-file-complexity-changed.js',
      '--json',
    ])

    expect(result.status).toBe(2)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('--json is supported only with --dry-run')
  })
})
