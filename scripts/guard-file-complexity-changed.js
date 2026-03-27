const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { resolveChangedFilesInput } = require('./run-local-selective-checks')

const MAX_LOC = 800
const SCAN_DIRS = ['api', 'app', 'components', 'hooks', 'stores', 'context', 'screens', 'services']
const EXTENSIONS = new Set(['.ts', '.tsx'])

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

const isScannedFile = (filePath) => {
  const normalized = String(filePath || '').trim().replace(/\\/g, '/')
  if (!normalized) return false
  if (!EXTENSIONS.has(path.extname(normalized))) return false
  return SCAN_DIRS.some((dir) => normalized === dir || normalized.startsWith(`${dir}/`))
}

const getScannedChangedFiles = (changedFiles) => {
  return (changedFiles || []).filter((filePath) => isScannedFile(filePath))
}

const countLines = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8')
  return content.split('\n').length
}

const getGitTrackedFileLoc = (filePath, ref = 'HEAD') => {
  const result = spawnSync('git', ['show', `${ref}:${filePath}`], {
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    return null
  }

  return String(result.stdout || '').split('\n').length
}

const scanChangedFiles = (changedFiles) => {
  const root = process.cwd()
  const scannedFiles = getScannedChangedFiles(changedFiles)
  const inspected = []
  const violations = []
  const legacyOversizedTouched = []

  for (const relPath of scannedFiles) {
    const absPath = path.resolve(root, relPath)
    if (!fs.existsSync(absPath)) continue
    const loc = countLines(absPath)
    const baselineLoc = getGitTrackedFileLoc(relPath)
    inspected.push({ file: relPath, loc, baselineLoc })

    if (loc <= MAX_LOC) continue

    if (baselineLoc == null || baselineLoc <= MAX_LOC) {
      violations.push({ file: relPath, loc, baselineLoc })
      continue
    }

    legacyOversizedTouched.push({ file: relPath, loc, baselineLoc })
  }

  inspected.sort((a, b) => b.loc - a.loc || a.file.localeCompare(b.file))
  violations.sort((a, b) => b.loc - a.loc || a.file.localeCompare(b.file))
  legacyOversizedTouched.sort((a, b) => b.loc - a.loc || a.file.localeCompare(b.file))

  return {
    maxLoc: MAX_LOC,
    scannedFiles,
    inspected,
    violations,
    legacyOversizedTouched,
  }
}

const emitText = ({ source, changedFiles, report, dryRun }) => {
  console.log(
    `guard-file-complexity-changed: source=${source}, changed-files=${changedFiles.length}, scanned=${report.scannedFiles.length}, violations=${report.violations.length}`
  )

  if (report.violations.length === 0) {
    if (dryRun) {
      console.log(`guard-file-complexity-changed: dry-run, no files exceed ${report.maxLoc} LOC.`)
    } else {
      console.log(`guard-file-complexity-changed: passed. No changed files exceed ${report.maxLoc} LOC.`)
    }
    if (report.legacyOversizedTouched.length > 0) {
      console.log('guard-file-complexity-changed: touched legacy oversized files (non-blocking):')
      for (const item of report.legacyOversizedTouched) {
        console.log(`  ${String(item.loc).padStart(5)} LOC  ${item.file} (baseline: ${item.baselineLoc})`)
      }
    }
    return
  }

  for (const item of report.violations) {
    console.log(`  ${String(item.loc).padStart(5)} LOC  ${item.file}`)
  }

  if (dryRun) {
    console.log('guard-file-complexity-changed: dry-run, violations reported but not blocking.')
  }
}

const emitJson = ({ source, changedFiles, report, dryRun }) => {
  process.stdout.write(`${JSON.stringify({
    contractVersion: 1,
    source,
    dryRun,
    maxLoc: report.maxLoc,
    changedFilesScanned: changedFiles.length,
    scannedFiles: report.scannedFiles,
    inspectedCount: report.inspected.length,
    violationCount: report.violations.length,
    violations: report.violations,
    legacyOversizedTouched: report.legacyOversizedTouched,
  }, null, 2)}\n`)
}

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    if (args.output === 'json' && !args.dryRun) {
      console.error('guard-file-complexity-changed: --json is supported only with --dry-run.')
      process.exit(2)
    }

    const input = resolveChangedFilesInput(args)
    const report = scanChangedFiles(input.files)

    if (args.output === 'json') {
      emitJson({
        source: input.source,
        changedFiles: input.files,
        report,
        dryRun: args.dryRun,
      })
      return
    }

    emitText({
      source: input.source,
      changedFiles: input.files,
      report,
      dryRun: args.dryRun,
    })

    if (!args.dryRun && report.violations.length > 0) {
      process.exit(1)
    }
  } catch (error) {
    console.error(`guard-file-complexity-changed: failed: ${String(error.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  MAX_LOC,
  SCAN_DIRS,
  EXTENSIONS,
  parseArgs,
  isScannedFile,
  getScannedChangedFiles,
  countLines,
  getGitTrackedFileLoc,
  scanChangedFiles,
}
