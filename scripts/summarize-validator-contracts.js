const fs = require('fs')
const path = require('path')
const { readJsonFileWithStatus, emitLines, appendLinesToStepSummary } = require('./summary-utils')

const DEFAULT_GUARD_FILE = 'test-results/validator-guard-comment-validation.json'
const DEFAULT_DOCS_FILE = 'test-results/validator-error-codes-doc-table-validation.json'
const DEFAULT_POLICY_FILE = 'test-results/validator-error-codes-policy-validation.json'
const SUMMARY_SCHEMA_VERSION = 1

const parseArgs = (argv) => {
  const args = {
    guardFile: DEFAULT_GUARD_FILE,
    docsFile: DEFAULT_DOCS_FILE,
    policyFile: DEFAULT_POLICY_FILE,
    jsonOutput: '',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--guard-file' && argv[i + 1]) {
      args.guardFile = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--docs-file' && argv[i + 1]) {
      args.docsFile = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--policy-file' && argv[i + 1]) {
      args.policyFile = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--json-output' && argv[i + 1]) {
      args.jsonOutput = argv[i + 1]
      i += 1
      continue
    }
  }

  return args
}

const toArray = (value) => (Array.isArray(value) ? value : [])

const toUniqueCodes = (errors) => {
  return [...new Set(toArray(errors).map((entry) => String(entry?.code || '').trim()).filter(Boolean))]
}

const buildCheckSummary = ({ id, title, file, payload, missing, parseError }) => {
  if (missing) {
    return {
      id,
      title,
      file,
      status: 'warning',
      ok: false,
      errorCount: 0,
      errorCodes: [],
      reason: `Validation payload not found: ${file}`,
    }
  }

  if (parseError) {
    return {
      id,
      title,
      file,
      status: 'warning',
      ok: false,
      errorCount: 0,
      errorCodes: [],
      reason: `Failed to parse validation payload: ${parseError}`,
    }
  }

  const ok = Boolean(payload?.ok)
  const errorCount = Number(payload?.errorCount || 0)
  const errorCodes = toUniqueCodes(payload?.errors)
  return {
    id,
    title,
    file,
    status: ok ? 'pass' : 'fail',
    ok,
    errorCount,
    errorCodes,
    reason: '',
  }
}

const buildSummaryPayload = ({ checks }) => {
  const failCount = checks.filter((check) => check.status === 'fail').length
  const warningCount = checks.filter((check) => check.status === 'warning').length
  const passCount = checks.filter((check) => check.status === 'pass').length
  const totalErrors = checks.reduce((sum, check) => sum + Number(check.errorCount || 0), 0)
  const errorCodes = [...new Set(checks.flatMap((check) => toArray(check.errorCodes)))]

  let overallStatus = 'pass'
  if (failCount > 0) {
    overallStatus = 'fail'
  } else if (warningCount > 0) {
    overallStatus = 'warning'
  }

  return {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    overallStatus,
    checkCount: checks.length,
    passCount,
    failCount,
    warningCount,
    totalErrors,
    errorCodes,
    checks,
  }
}

const buildSummaryLines = ({ summary }) => {
  const lines = [
    '### Validator Contracts Validation',
    `- Status: ${summary.overallStatus}`,
    `- Checks: ${summary.passCount}/${summary.checkCount} pass, ${summary.failCount} fail, ${summary.warningCount} warning`,
    `- Total errors: ${summary.totalErrors}`,
  ]

  if (summary.errorCodes.length > 0) {
    lines.push(`- Error codes: ${summary.errorCodes.join(', ')}`)
  }

  const checkLines = summary.checks.map((check) => {
    const details = [`errors=${check.errorCount}`]
    if (check.errorCodes.length > 0) {
      details.push(`codes=${check.errorCodes.join(',')}`)
    }
    if (check.reason) {
      details.push(`note=${check.reason}`)
    }
    return `- ${check.id}: ${check.status} (${details.join('; ')})`
  })
  lines.push(...checkLines)
  lines.push('')
  return lines
}

const writeJsonSummary = ({ jsonOutput, payload }) => {
  if (!jsonOutput) return false
  const outputPath = path.resolve(process.cwd(), jsonOutput)
  const outputDir = path.dirname(outputPath)
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return true
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const checks = [
    buildCheckSummary({
      id: 'validator-guard-comment-validation',
      title: 'Validator Guard Comment Validation',
      file: args.guardFile,
      ...readJsonFileWithStatus(args.guardFile),
    }),
    buildCheckSummary({
      id: 'validator-error-codes-doc-table-validation',
      title: 'Validator Error Codes Docs Table Validation',
      file: args.docsFile,
      ...readJsonFileWithStatus(args.docsFile),
    }),
    buildCheckSummary({
      id: 'validator-error-codes-policy-validation',
      title: 'Validator Error Codes Policy Validation',
      file: args.policyFile,
      ...readJsonFileWithStatus(args.policyFile),
    }),
  ]

  const summary = buildSummaryPayload({ checks })
  writeJsonSummary({ jsonOutput: args.jsonOutput, payload: summary })

  const lines = buildSummaryLines({ summary })
  emitLines(lines)
  appendLinesToStepSummary({ lines })
}

if (require.main === module) {
  main()
}

module.exports = {
  DEFAULT_GUARD_FILE,
  DEFAULT_DOCS_FILE,
  DEFAULT_POLICY_FILE,
  SUMMARY_SCHEMA_VERSION,
  parseArgs,
  toUniqueCodes,
  buildCheckSummary,
  buildSummaryPayload,
  buildSummaryLines,
  writeJsonSummary,
}
