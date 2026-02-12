const SCHEMA_VERSION = 1
const {
  getRuntimeConfigDiagnosticsCore,
  resolveRoutingApiKeyWithSourceCore,
} = require('../utils/runtimeConfigContract')

const getRuntimeConfigDiagnostics = (env = process.env) => getRuntimeConfigDiagnosticsCore(env)
const resolveRoutingApiKeyWithSource = (env = process.env) => resolveRoutingApiKeyWithSourceCore(env)

const buildRuntimeConfigReport = (env = process.env) => {
  const diagnostics = getRuntimeConfigDiagnostics(env)
  const errors = diagnostics.filter((item) => item.severity === 'error')
  const warnings = diagnostics.filter((item) => item.severity === 'warning')
  return {
    schemaVersion: SCHEMA_VERSION,
    ok: errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    diagnostics,
  }
}

const printHumanReport = (report) => {
  if (report.diagnostics.length === 0) {
    console.log('runtime-config diagnostics passed: no issues found.')
    return
  }

  console.log(
    `runtime-config diagnostics found ${report.errorCount} error(s), ${report.warningCount} warning(s):`
  )
  report.diagnostics.forEach((item) => {
    console.log(`- [${item.severity}] ${item.code}: ${item.message}`)
  })
}

const main = () => {
  const args = process.argv.slice(2)
  const jsonMode = args.includes('--json')
  const strictWarnings = args.includes('--strict-warnings')
  const report = buildRuntimeConfigReport(process.env)
  const shouldFail = !report.ok || (strictWarnings && report.warningCount > 0)

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printHumanReport(report)
  }

  if (shouldFail) {
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  SCHEMA_VERSION,
  buildRuntimeConfigReport,
  getRuntimeConfigDiagnostics,
  resolveRoutingApiKeyWithSource,
}
