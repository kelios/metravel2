const fs = require('fs')
const path = require('path')

const parseArgs = (argv) => {
  const out = {
    file: 'test-results/quality-summary.json',
    format: 'json',
    output: 'text',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--file' && argv[i + 1]) {
      out.file = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--format' && argv[i + 1]) {
      const fmt = String(argv[i + 1]).trim().toLowerCase()
      if (fmt === 'json' || fmt === 'csv') out.format = fmt
      i += 1
      continue
    }
    if (token === '--json') {
      out.output = 'json'
      continue
    }
  }

  return out
}

const readSnapshot = (filePath) => {
  const resolved = path.resolve(process.cwd(), filePath)
  if (!fs.existsSync(resolved)) {
    throw new Error(`file not found: ${filePath}`)
  }
  const payload = JSON.parse(fs.readFileSync(resolved, 'utf8'))
  if (!payload || typeof payload !== 'object') {
    throw new Error('snapshot is not an object')
  }
  if (!Array.isArray(payload.smokeSuiteFiles)) {
    throw new Error('snapshot.smokeSuiteFiles is missing or not an array')
  }
  const suites = payload.smokeSuiteFiles
    .map((v) => String(v).trim())
    .filter(Boolean)
  if (suites.length === 0) {
    throw new Error('snapshot.smokeSuiteFiles is empty')
  }
  return suites
}

const quoteForShell = (value) => {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`
}

const renderBaselineValue = (suites, format) => {
  if (format === 'csv') return suites.join(',')
  return JSON.stringify(suites)
}

const renderRecommendation = ({ file, format, suites }) => {
  const baselineValue = renderBaselineValue(suites, format)
  const command = `gh variable set SMOKE_SUITE_FILES_BASELINE --body ${quoteForShell(baselineValue)}`

  return {
    sourceSnapshot: file,
    suiteCount: suites.length,
    format,
    baselineValue,
    ghCommand: command,
  }
}

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    const suites = readSnapshot(args.file)
    const recommendation = renderRecommendation({
      file: args.file,
      format: args.format,
      suites,
    })

    if (args.output === 'json') {
      console.log(JSON.stringify(recommendation, null, 2))
      return
    }

    console.log('Smoke suite baseline recommendation')
    console.log(`- Source snapshot: ${recommendation.sourceSnapshot}`)
    console.log(`- Suites: ${recommendation.suiteCount}`)
    console.log(`- Format: ${recommendation.format}`)
    console.log(`- Recommended SMOKE_SUITE_FILES_BASELINE: ${recommendation.baselineValue}`)
    console.log('- CLI command:')
    console.log(`  ${recommendation.ghCommand}`)
  } catch (error) {
    console.error(`Failed to recommend smoke suite baseline: ${String(error.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  parseArgs,
  readSnapshot,
  renderBaselineValue,
  renderRecommendation,
}
