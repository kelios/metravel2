const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const minimatchModule = require('minimatch')
const { resolveChangedFilesInput, runSelectiveChecks } = require('./run-local-selective-checks')

const parseArgs = (argv) => {
  const out = {
    baseRef: '',
    changedFilesFile: '',
    dryRun: false,
    output: 'text',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--base-ref' && argv[i + 1]) {
      out.baseRef = String(argv[i + 1]).trim()
      i += 1
      continue
    }
    if (token === '--changed-files-file' && argv[i + 1]) {
      out.changedFilesFile = String(argv[i + 1]).trim()
      i += 1
      continue
    }
    if (token === '--dry-run') {
      out.dryRun = true
      continue
    }
    if (token === '--json') {
      out.output = 'json'
    }
  }

  return out
}

const LINTABLE_FILE_PATTERN = /\.(js|jsx|ts|tsx|mjs|cjs)$/
const ESLINT_CACHE_LOCATION = 'node_modules/.cache/eslint/check-fast/.eslintcache'
const MINIMATCH_OPTIONS = Object.freeze({ dot: true })
const eslintConfig = require(path.resolve(process.cwd(), 'eslint.config.js'))
const ESLINT_IGNORE_PATTERNS = Array.isArray(eslintConfig?.[0]?.ignores)
  ? eslintConfig[0].ignores
  : []
const matchGlob = (() => {
  if (typeof minimatchModule === 'function') {
    return minimatchModule
  }

  if (typeof minimatchModule?.minimatch === 'function') {
    return minimatchModule.minimatch
  }

  throw new TypeError('minimatch export does not expose a matcher function')
})()
const MatcherConstructor = typeof minimatchModule?.Minimatch === 'function'
  ? minimatchModule.Minimatch
  : null

const normalizeForMatching = (filePath) => String(filePath || '').replace(/\\/g, '/')

const createIgnorePatternMatcher = (pattern) => {
  const normalizedPattern = normalizeForMatching(pattern)
  if (!normalizedPattern) return null

  const globMatcher = MatcherConstructor
    ? new MatcherConstructor(normalizedPattern, MINIMATCH_OPTIONS)
    : null
  const prefix = normalizedPattern.endsWith('/') ? normalizedPattern : ''

  return (filePath) => {
    const normalizedFilePath = normalizeForMatching(filePath)
    if (!normalizedFilePath) {
      return false
    }

    const isGlobMatch = globMatcher
      ? globMatcher.match(normalizedFilePath)
      : matchGlob(normalizedFilePath, normalizedPattern, MINIMATCH_OPTIONS)

    if (isGlobMatch) {
      return true
    }

    return prefix ? normalizedFilePath.startsWith(prefix) : false
  }
}

const IGNORE_PATTERN_MATCHERS = ESLINT_IGNORE_PATTERNS
  .map((pattern) => createIgnorePatternMatcher(pattern))
  .filter(Boolean)

const matchesIgnorePattern = (filePath, patternOrMatcher) => {
  if (typeof patternOrMatcher === 'function') {
    return patternOrMatcher(filePath)
  }

  const matcher = createIgnorePatternMatcher(patternOrMatcher)
  return matcher ? matcher(filePath) : false
}

const isIgnoredLintTarget = (filePath) => {
  return IGNORE_PATTERN_MATCHERS.some((matcher) => matchesIgnorePattern(filePath, matcher))
}

const getLintTargets = (changedFiles) => {
  return (changedFiles || []).filter((filePath) => {
    if (!LINTABLE_FILE_PATTERN.test(filePath)) {
      return false
    }

    if (!fs.existsSync(path.resolve(process.cwd(), filePath))) {
      return false
    }

    return !isIgnoredLintTarget(filePath)
  })
}

const buildEslintArgs = (lintTargets) => {
  return [
    'eslint',
    '--cache',
    '--cache-location',
    ESLINT_CACHE_LOCATION,
    '--max-warnings=0',
    ...(lintTargets || []),
  ]
}

const runCommand = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'inherit',
  })
  return result.status ?? 1
}

const runFastScopeChecks = ({ changedFiles, dryRun, output }) => {
  const lintTargets = getLintTargets(changedFiles)
  const selectiveChecks = runSelectiveChecks({ changedFiles, dryRun, output })

  return {
    lintTargets,
    selectiveChecks,
  }
}

const emitTextSummary = ({ source, changedFiles, lintTargets }) => {
  console.log(`fast-scope-checks: source=${source}, changed-files=${changedFiles.length}, lint-targets=${lintTargets.length}`)
  if (changedFiles.length > 0) {
    console.log(`fast-scope-checks: files=${changedFiles.join(', ')}`)
  }
}

const emitJsonSummary = ({ source, changedFiles, lintTargets, selectiveChecks }) => {
  const payload = {
    contractVersion: 1,
    source,
    changedFilesScanned: changedFiles.length,
    changedFiles,
    lintTargets,
    checks: selectiveChecks.map((check) => JSON.parse(check.result.stdout)),
  }
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    if (args.output === 'json' && !args.dryRun) {
      console.error('fast-scope-checks: --json is supported only with --dry-run.')
      process.exit(2)
    }

    const input = resolveChangedFilesInput(args)
    const result = runFastScopeChecks({
      changedFiles: input.files,
      dryRun: args.dryRun,
      output: args.output,
    })

    const failedSelective = result.selectiveChecks.find((check) => check.result.status !== 0)
    if (failedSelective) {
      process.exit(failedSelective.result.status)
    }

    if (args.output === 'json') {
      emitJsonSummary({
        source: input.source,
        changedFiles: input.files,
        lintTargets: result.lintTargets,
        selectiveChecks: result.selectiveChecks,
      })
      return
    }

    emitTextSummary({
      source: input.source,
      changedFiles: input.files,
      lintTargets: result.lintTargets,
    })

    if (args.dryRun) {
      console.log('fast-scope-checks: dry-run, skipping guard:external-links and eslint.')
      return
    }

    const guardStatus = runCommand('npm', ['run', 'guard:external-links'])
    if (guardStatus !== 0) {
      process.exit(guardStatus)
    }

    if (result.lintTargets.length === 0) {
      console.log('fast-scope-checks: no lintable changed files, eslint skipped.')
      return
    }

    const eslintStatus = runCommand('npx', buildEslintArgs(result.lintTargets))
    if (eslintStatus !== 0) {
      process.exit(eslintStatus)
    }
  } catch (error) {
    console.error(`fast-scope-checks: failed: ${String(error.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  LINTABLE_FILE_PATTERN,
  ESLINT_IGNORE_PATTERNS,
  IGNORE_PATTERN_MATCHERS,
  MINIMATCH_OPTIONS,
  parseArgs,
  normalizeForMatching,
  matchesIgnorePattern,
  createIgnorePatternMatcher,
  getLintTargets,
  buildEslintArgs,
  ESLINT_CACHE_LOCATION,
  isIgnoredLintTarget,
  runFastScopeChecks,
}
