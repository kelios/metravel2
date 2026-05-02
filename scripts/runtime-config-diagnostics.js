const fs = require('fs')
const path = require('path')

const SCHEMA_VERSION = 1
const {
  getRuntimeConfigDiagnosticsCore,
  resolveRoutingApiKeyWithSourceCore,
} = require('../utils/runtimeConfigContract')

const getRuntimeConfigDiagnostics = (env = process.env) => getRuntimeConfigDiagnosticsCore(env)
const resolveRoutingApiKeyWithSource = (env = process.env) => resolveRoutingApiKeyWithSourceCore(env)

const parseDotEnv = (contents) => {
  const parsed = {}
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) return

    const key = trimmed.slice(0, separatorIndex).trim()
    let value = trimmed.slice(separatorIndex + 1).trim()
    const quote = value[0]
    if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
      value = value.slice(1, -1)
    }
    parsed[key] = value
  })
  return parsed
}

const loadEnvFile = (filePath = path.resolve(__dirname, '..', '.env'), baseEnv = process.env) => {
  if (!fs.existsSync(filePath)) return { ...baseEnv }

  const fileEnv = parseDotEnv(fs.readFileSync(filePath, 'utf8'))
  return {
    ...fileEnv,
    ...baseEnv,
  }
}

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
  const report = buildRuntimeConfigReport(loadEnvFile())
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
  loadEnvFile,
  parseDotEnv,
  resolveRoutingApiKeyWithSource,
}
