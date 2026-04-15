const fs = require('fs')
const path = require('path')
const { runNodeCli, makeTempDir, writeTextFile } = require('./cli-test-utils')
const {
  parseArgs,
  getLintTargets,
  buildEslintArgs,
  ESLINT_CACHE_LOCATION,
  MINIMATCH_OPTIONS,
  normalizeForMatching,
  matchesIgnorePattern,
  createIgnorePatternMatcher,
  isIgnoredLintTarget,
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
    ])
  })

  it('skips deleted or missing changed source files from lint scope', () => {
    expect(getLintTargets([
      '__tests__/services/blockRenderer.test.ts',
      'scripts/run-fast-scope-checks.js',
    ])).toEqual([
      'scripts/run-fast-scope-checks.js',
    ])
  })

  it('builds cached eslint invocation with zero warning budget', () => {
    expect(buildEslintArgs([
      'scripts/run-fast-scope-checks.js',
      'components/Button.tsx',
    ])).toEqual([
      'eslint',
      '--cache',
      '--cache-location',
      ESLINT_CACHE_LOCATION,
      '--max-warnings=0',
      'scripts/run-fast-scope-checks.js',
      'components/Button.tsx',
    ])
  })

  describe('ignore pattern matching', () => {
    it('normalizes windows paths before matching ignore patterns', () => {
      expect(normalizeForMatching('coverage\\reports\\index.js')).toBe('coverage/reports/index.js')
      expect(matchesIgnorePattern('coverage\\reports\\index.js', 'coverage/')).toBe(true)
    })

    it('supports current minimatch module exports when compiling ignore matchers', () => {
      const matcher = createIgnorePatternMatcher('**/playwright-report/**')

      expect(matcher).not.toBeNull()
      expect(matchesIgnorePattern('e2e/playwright-report/output.json', matcher)).toBe(true)
      expect(MINIMATCH_OPTIONS).toEqual({ dot: true })
    })

    it('ignores exact-file and directory-based eslint patterns', () => {
      expect(isIgnoredLintTarget('app/+html.tsx')).toBe(true)
      expect(isIgnoredLintTarget('tmp/cache/artifact.js')).toBe(true)
      expect(isIgnoredLintTarget('scripts/run-fast-scope-checks.js')).toBe(false)
    })
  })

  it('builds fast check plan from changed files', () => {
    const result = runFastScopeChecks({
      changedFiles: ['docs/TESTING.md', 'scripts/validator-output.js'],
      dryRun: true,
      output: 'json',
    })

    expect(result.lintTargets).toEqual(['scripts/validator-output.js'])
    expect(result.selectiveChecks).toHaveLength(3)
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
      'app-targeted-tests',
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
