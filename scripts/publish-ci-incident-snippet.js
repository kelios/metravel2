const fs = require('fs')
const path = require('path')
const { buildIncidentMarkdown } = require('./generate-ci-incident')

const INCIDENT_PAYLOAD_SCHEMA_VERSION = 1

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
    artifactUrl: '',
    artifactId: '',
    validatorArtifactUrl: '',
    validatorArtifactId: '',
    runtimeArtifactUrl: '',
    runtimeArtifactId: '',
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
    if (token === '--artifact-url' && argv[i + 1]) {
      out.artifactUrl = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--artifact-id' && argv[i + 1]) {
      out.artifactId = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--validator-artifact-url' && argv[i + 1]) {
      out.validatorArtifactUrl = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--validator-artifact-id' && argv[i + 1]) {
      out.validatorArtifactId = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--runtime-artifact-url' && argv[i + 1]) {
      out.runtimeArtifactUrl = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--runtime-artifact-id' && argv[i + 1]) {
      out.runtimeArtifactId = argv[i + 1]
      i += 1
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

const resolveArtifactUrl = ({ workflowRun, artifactUrl, artifactId }) => {
  const explicit = String(artifactUrl || '').trim()
  if (explicit) return explicit

  const runUrl = String(workflowRun || '').trim()
  const id = String(artifactId || '').trim()
  if (!runUrl || !id) return ''
  if (!/^https:\/\/github\.com\/.+\/actions\/runs\/\d+$/.test(runUrl)) return ''
  if (!/^\d+$/.test(id)) return ''
  return `${runUrl}/artifacts/${id}`
}

const resolveArtifactSource = ({ failureClass, artifactUrl, workflowRun, artifactId }) => {
  const explicit = String(artifactUrl || '').trim()
  if (explicit) return 'explicit'

  const runUrl = String(workflowRun || '').trim()
  const id = String(artifactId || '').trim()
  if (runUrl && id && /^https:\/\/github\.com\/.+\/actions\/runs\/\d+$/.test(runUrl) && /^\d+$/.test(id)) {
    return 'run_id'
  }
  if (failureClass === 'selective_contract') return 'fallback'
  return 'none'
}

const resolveValidatorArtifactSource = ({ failureClass, artifactUrl, workflowRun, artifactId }) => {
  const explicit = String(artifactUrl || '').trim()
  if (explicit) return 'explicit'

  const runUrl = String(workflowRun || '').trim()
  const id = String(artifactId || '').trim()
  if (runUrl && id && /^https:\/\/github\.com\/.+\/actions\/runs\/\d+$/.test(runUrl) && /^\d+$/.test(id)) {
    return 'run_id'
  }
  if (failureClass === 'validator_contract') return 'fallback'
  return 'none'
}

const resolveRuntimeArtifactSource = ({ failureClass, artifactUrl, workflowRun, artifactId }) => {
  const explicit = String(artifactUrl || '').trim()
  if (explicit) return 'explicit'

  const runUrl = String(workflowRun || '').trim()
  const id = String(artifactId || '').trim()
  if (runUrl && id && /^https:\/\/github\.com\/.+\/actions\/runs\/\d+$/.test(runUrl) && /^\d+$/.test(id)) {
    return 'run_id'
  }
  if (failureClass === 'config_contract') return 'fallback'
  return 'none'
}

const derivePrimaryArtifactKind = (failureClass) => {
  if (failureClass === 'selective_contract') return 'selective_decisions'
  if (failureClass === 'validator_contract') return 'validator_contracts'
  if (failureClass === 'config_contract') return 'runtime_config_diagnostics'
  return 'none'
}

const normalizeFollowUp = ({ failureClass, followUp, artifactUrl }) => {
  const base = String(followUp || '').trim() || 'yes'
  if (failureClass !== 'selective_contract') {
    return base
  }
  if (/selective-decisions/i.test(base)) {
    return base
  }
  const artifactRef = String(artifactUrl || '').trim()
    || 'test-results/selective-decisions.json'
  return `${base}; inspect selective-decisions artifact (${artifactRef})`
}

const normalizeValidatorFollowUp = ({ failureClass, followUp, artifactUrl }) => {
  const base = String(followUp || '').trim() || 'yes'
  if (failureClass !== 'validator_contract') {
    return base
  }
  if (/validator-contracts-summary-validation/i.test(base) || /validator contracts artifact/i.test(base)) {
    return base
  }
  const artifactRef = String(artifactUrl || '').trim()
    || 'test-results/validator-contracts-summary-validation.json'
  return `${base}; inspect validator-contracts-summary-validation artifact (${artifactRef})`
}

const normalizeRuntimeFollowUp = ({ failureClass, followUp, artifactUrl }) => {
  const base = String(followUp || '').trim() || 'yes'
  if (failureClass !== 'config_contract') {
    return base
  }
  if (/runtime-config-diagnostics/i.test(base) || /runtime config diagnostics artifact/i.test(base)) {
    return base
  }
  const artifactRef = String(artifactUrl || '').trim()
    || 'test-results/runtime-config-diagnostics.json'
  return `${base}; inspect runtime-config-diagnostics artifact (${artifactRef})`
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
  schemaVersion = INCIDENT_PAYLOAD_SCHEMA_VERSION,
  failureClass,
  recommendationId,
  workflowRun,
  branchPr,
  outputFile,
  markdown,
  artifactUrl = '',
  artifactSource = 'none',
  validatorArtifactUrl = '',
  validatorArtifactSource = 'none',
  runtimeArtifactUrl = '',
  runtimeArtifactSource = 'none',
  primaryArtifactKind = 'none',
}) => {
  return {
    schemaVersion,
    failureClass,
    recommendationId,
    workflowRun,
    branchPr,
    outputFile,
    markdown,
    artifactUrl,
    artifactSource,
    validatorArtifactUrl,
    validatorArtifactSource,
    runtimeArtifactUrl,
    runtimeArtifactSource,
    primaryArtifactKind,
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
  artifactUrl,
  artifactId,
  validatorArtifactUrl,
  validatorArtifactId,
  runtimeArtifactUrl,
  runtimeArtifactId,
  lintResult = String(process.env.LINT_RESULT || '').trim(),
  smokeResult = String(process.env.SMOKE_RESULT || '').trim(),
  stepSummaryPath,
}) => {
  const summary = readQualitySummary(summaryFile)
  const failureClass = resolveFailureClass({ summary, lintResult, smokeResult })
  const recommendationId = resolveRecommendationId(summary)
  const resolvedArtifactUrl = resolveArtifactUrl({
    workflowRun,
    artifactUrl,
    artifactId,
  })
  const artifactSource = resolveArtifactSource({
    failureClass,
    artifactUrl,
    workflowRun,
    artifactId,
  })
  const resolvedValidatorArtifactUrl = resolveArtifactUrl({
    workflowRun,
    artifactUrl: validatorArtifactUrl,
    artifactId: validatorArtifactId,
  })
  const validatorArtifactSource = resolveValidatorArtifactSource({
    failureClass,
    artifactUrl: validatorArtifactUrl,
    workflowRun,
    artifactId: validatorArtifactId,
  })
  const resolvedRuntimeArtifactUrl = resolveArtifactUrl({
    workflowRun,
    artifactUrl: runtimeArtifactUrl,
    artifactId: runtimeArtifactId,
  })
  const runtimeArtifactSource = resolveRuntimeArtifactSource({
    failureClass,
    artifactUrl: runtimeArtifactUrl,
    workflowRun,
    artifactId: runtimeArtifactId,
  })
  const resolvedFollowUp = normalizeFollowUp({
    failureClass,
    followUp,
    artifactUrl: resolvedArtifactUrl,
  })
  const normalizedFollowUp = normalizeValidatorFollowUp({
    failureClass,
    followUp: resolvedFollowUp,
    artifactUrl: resolvedValidatorArtifactUrl,
  })
  const finalFollowUp = normalizeRuntimeFollowUp({
    failureClass,
    followUp: normalizedFollowUp,
    artifactUrl: resolvedRuntimeArtifactUrl,
  })
  const primaryArtifactKind = derivePrimaryArtifactKind(failureClass)

  const markdown = buildIncidentMarkdown({
    workflowRun,
    branchOrPr: branchPr,
    failureClass,
    recommendationId,
    impact,
    owner,
    eta,
    immediateAction,
    followUp: finalFollowUp,
    selectiveArtifact: resolvedArtifactUrl,
    validatorArtifact: resolvedValidatorArtifactUrl,
    runtimeArtifact: failureClass === 'config_contract' ? resolvedRuntimeArtifactUrl : '',
  })

  const writtenOutputFile = writeIncidentFile(outputFile, markdown)
  appendStepSummary(markdown, stepSummaryPath)
  return renderIncidentPayload({
    schemaVersion: INCIDENT_PAYLOAD_SCHEMA_VERSION,
    failureClass,
    recommendationId,
    workflowRun,
    branchPr,
    outputFile: writtenOutputFile,
    markdown,
    artifactUrl: resolvedArtifactUrl,
    artifactSource,
    validatorArtifactUrl: resolvedValidatorArtifactUrl,
    validatorArtifactSource,
    runtimeArtifactUrl: failureClass === 'config_contract' ? resolvedRuntimeArtifactUrl : '',
    runtimeArtifactSource: failureClass === 'config_contract' ? runtimeArtifactSource : 'none',
    primaryArtifactKind,
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
  INCIDENT_PAYLOAD_SCHEMA_VERSION,
  parseArgs,
  readQualitySummary,
  fallbackFailureClass,
  resolveFailureClass,
  resolveRecommendationId,
  resolveArtifactUrl,
  resolveArtifactSource,
  resolveValidatorArtifactSource,
  resolveRuntimeArtifactSource,
  derivePrimaryArtifactKind,
  normalizeFollowUp,
  normalizeValidatorFollowUp,
  normalizeRuntimeFollowUp,
  appendStepSummary,
  writeIncidentFile,
  renderIncidentPayload,
  publishIncidentSnippet,
}
