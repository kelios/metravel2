const fs = require('fs')
const path = require('path')
const {
  readSnapshot,
  renderRecommendation,
} = require('./recommend-smoke-suite-baseline')

const parseArgs = (argv) => {
  const args = {
    summaryFile: 'test-results/quality-summary.json',
    outputFile: 'test-results/smoke-suite-baseline-recommendation.json',
    format: 'json',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--summary-file' && argv[i + 1]) {
      args.summaryFile = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--output-file' && argv[i + 1]) {
      args.outputFile = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--format' && argv[i + 1]) {
      const format = String(argv[i + 1]).trim().toLowerCase()
      if (format === 'json' || format === 'csv') {
        args.format = format
      }
      i += 1
      continue
    }
  }

  return args
}

const readJsonFile = (filePath) => {
  const resolved = path.resolve(process.cwd(), filePath)
  if (!fs.existsSync(resolved)) return null
  return JSON.parse(fs.readFileSync(resolved, 'utf8'))
}

const getDriftCounts = (summary) => {
  const added = Array.isArray(summary?.smokeSuiteAddedFiles)
    ? summary.smokeSuiteAddedFiles.length
    : 0
  const removed = Array.isArray(summary?.smokeSuiteRemovedFiles)
    ? summary.smokeSuiteRemovedFiles.length
    : 0
  return {
    added,
    removed,
    total: added + removed,
  }
}

const buildSummaryMarkdown = ({ drift, recommendation }) => {
  if (!recommendation) {
    return [
      '',
      '### Smoke Suite Baseline Recommendation',
      `- Suite drift not detected (+${drift.added} / -${drift.removed}). Baseline update is not required.`,
      '',
    ].join('\n')
  }

  return [
    '',
    '### Smoke Suite Baseline Recommendation',
    `- Suite drift detected: +${drift.added} / -${drift.removed}.`,
    `- Source snapshot: ${recommendation.sourceSnapshot}`,
    `- Suites: ${recommendation.suiteCount}`,
    `- Format: ${recommendation.format}`,
    `- Recommended value: \`${recommendation.baselineValue}\``,
    '- CLI command:',
    `  - \`${recommendation.ghCommand}\``,
    '',
  ].join('\n')
}

const appendStepSummary = (markdown, stepSummaryPath) => {
  const summaryPath = stepSummaryPath || process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) return false
  fs.appendFileSync(summaryPath, markdown, 'utf8')
  return true
}

const writeRecommendationFile = (outputFile, recommendation) => {
  const resolved = path.resolve(process.cwd(), outputFile)
  const outputDir = path.dirname(resolved)
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(resolved, JSON.stringify(recommendation, null, 2), 'utf8')
}

const publishRecommendation = ({
  summaryFile,
  outputFile,
  format,
  stepSummaryPath,
}) => {
  const qualitySummary = readJsonFile(summaryFile)
  if (!qualitySummary) {
    const markdown = [
      '',
      '### Smoke Suite Baseline Recommendation',
      `- Skipped: quality summary file not found at \`${summaryFile}\`.`,
      '',
    ].join('\n')
    appendStepSummary(markdown, stepSummaryPath)
    return { published: false, drift: { added: 0, removed: 0, total: 0 } }
  }

  const drift = getDriftCounts(qualitySummary)
  if (drift.total === 0) {
    const markdown = buildSummaryMarkdown({ drift, recommendation: null })
    appendStepSummary(markdown, stepSummaryPath)
    return { published: true, drift, recommendation: null }
  }

  const suites = readSnapshot(summaryFile)
  const recommendation = renderRecommendation({
    file: summaryFile,
    format,
    suites,
  })

  writeRecommendationFile(outputFile, recommendation)
  const markdown = buildSummaryMarkdown({ drift, recommendation })
  appendStepSummary(markdown, stepSummaryPath)

  return { published: true, drift, recommendation }
}

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    publishRecommendation(args)
  } catch (error) {
    console.error(`Failed to publish smoke suite baseline recommendation: ${String(error.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  parseArgs,
  readJsonFile,
  getDriftCounts,
  buildSummaryMarkdown,
  appendStepSummary,
  writeRecommendationFile,
  publishRecommendation,
}
