const fs = require('fs')
const path = require('path')
const { buildIncidentMarkdown } = require('./generate-ci-incident')

const parseArgs = (argv) => {
  const out = {
    summaryFile: 'test-results/quality-summary.json',
    outputFile: 'test-results/ci-incident-snippet.md',
    output: 'text',
    workflowRun: '',
    branchPr: '',
    impact: '<fill>',
    owner: '<fill>',
    eta: '<fill>',
    immediateAction: 'Initial triage started',
    followUp: 'yes',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--summary-file' && argv[i + 1]) {
      out.summaryFile = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--workflow-run' && argv[i + 1]) {
      out.workflowRun = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--output-file' && argv[i + 1]) {
      out.outputFile = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--branch-pr' && argv[i + 1]) {
      out.branchPr = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--impact' && argv[i + 1]) {
      out.impact = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--owner' && argv[i + 1]) {
      out.owner = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--eta' && argv[i + 1]) {
      out.eta = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--immediate-action' && argv[i + 1]) {
      out.immediateAction = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--follow-up' && argv[i + 1]) {
      out.followUp = argv[i + 1]
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

const readQualitySummary = (summaryFile) => {
  const resolved = path.resolve(process.cwd(), summaryFile)
  if (!fs.existsSync(resolved)) return null
  return JSON.parse(fs.readFileSync(resolved, 'utf8'))
}

const fallbackFailureClass = ({ lintResult, smokeResult }) => {
  if (lintResult !== 'success' && smokeResult === 'success') return 'lint_only'
  if (lintResult === 'success' && smokeResult !== 'success') return 'smoke_only'
  return 'mixed'
}

const resolveFailureClass = ({ summary, lintResult, smokeResult }) => {
  const fromSummary = String(summary?.failureClass || '').trim()
  if (fromSummary && fromSummary !== 'pass') return fromSummary
  return fallbackFailureClass({ lintResult, smokeResult })
}

const resolveRecommendationId = (summary) => {
  const id = String(summary?.recommendationId || '').trim()
  if (id) return id
  return '<from Quality Gate Summary>'
}

const appendStepSummary = (markdown, stepSummaryPath) => {
  const summaryPath = stepSummaryPath || process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) return false
  fs.appendFileSync(summaryPath, markdown, 'utf8')
  return true
}

const writeIncidentFile = (outputFile, markdown) => {
  const resolved = path.resolve(process.cwd(), outputFile)
  const outputDir = path.dirname(resolved)
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(resolved, markdown, 'utf8')
  return resolved
}

const renderIncidentPayload = ({
  failureClass,
  recommendationId,
  workflowRun,
  branchPr,
  outputFile,
  markdown,
}) => {
  return {
    failureClass,
    recommendationId,
    workflowRun,
    branchPr,
    outputFile,
    markdown,
  }
}

const publishIncidentSnippet = ({
  summaryFile,
  outputFile,
  workflowRun,
  branchPr,
  impact,
  owner,
  eta,
  immediateAction,
  followUp,
  lintResult = String(process.env.LINT_RESULT || '').trim(),
  smokeResult = String(process.env.SMOKE_RESULT || '').trim(),
  stepSummaryPath,
}) => {
  const summary = readQualitySummary(summaryFile)
  const failureClass = resolveFailureClass({ summary, lintResult, smokeResult })
  const recommendationId = resolveRecommendationId(summary)

  const markdown = buildIncidentMarkdown({
    workflowRun,
    branchOrPr: branchPr,
    failureClass,
    recommendationId,
    impact,
    owner,
    eta,
    immediateAction,
    followUp,
  })

  const writtenOutputFile = writeIncidentFile(outputFile, markdown)
  appendStepSummary(markdown, stepSummaryPath)
  return renderIncidentPayload({
    failureClass,
    recommendationId,
    workflowRun,
    branchPr,
    outputFile: writtenOutputFile,
    markdown,
  })
}

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    const result = publishIncidentSnippet(args)
    if (args.output === 'json') {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    }
  } catch (error) {
    console.error(`Failed to publish CI incident snippet: ${String(error.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  parseArgs,
  readQualitySummary,
  fallbackFailureClass,
  resolveFailureClass,
  resolveRecommendationId,
  appendStepSummary,
  writeIncidentFile,
  renderIncidentPayload,
  publishIncidentSnippet,
}
