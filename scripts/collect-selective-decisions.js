const fs = require('fs')
const path = require('path')
const {
  SELECTIVE_DECISIONS_AGGREGATE_SCHEMA_VERSION,
  validateSelectiveDecision,
} = require('./selective-decision-contract')

const parseArgs = (argv) => {
  const args = {
    schemaFile: 'test-results/selective/schema/schema-selective-decision.json',
    validatorFile: 'test-results/selective/validator/validator-selective-decision.json',
    outputFile: 'test-results/selective-decisions.json',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--schema-file' && argv[i + 1]) {
      args.schemaFile = String(argv[i + 1]).trim()
      i += 1
      continue
    }
    if (token === '--validator-file' && argv[i + 1]) {
      args.validatorFile = String(argv[i + 1]).trim()
      i += 1
      continue
    }
    if (token === '--output-file' && argv[i + 1]) {
      args.outputFile = String(argv[i + 1]).trim()
      i += 1
      continue
    }
  }

  return args
}

const readJsonIfExists = (filePath) => {
  const resolved = path.resolve(process.cwd(), filePath)
  if (!fs.existsSync(resolved)) return null
  try {
    return JSON.parse(fs.readFileSync(resolved, 'utf8'))
  } catch {
    return 'parse-error'
  }
}

const collectSelectiveDecisions = ({ schemaFile, validatorFile }) => {
  const decisions = []
  const warnings = []
  const sources = [
    { label: 'schema-contract-checks', filePath: schemaFile },
    { label: 'validator-contract-checks', filePath: validatorFile },
  ]

  sources.forEach(({ label, filePath }) => {
    const payload = readJsonIfExists(filePath)
    if (payload === null) {
      warnings.push(`${label}: decision file not found (${filePath}).`)
      return
    }
    if (payload === 'parse-error') {
      warnings.push(`${label}: cannot parse decision JSON (${filePath}).`)
      return
    }

    const errors = validateSelectiveDecision(payload)
    if (errors.length > 0) {
      warnings.push(`${label}: invalid decision payload: ${errors.join(' ')}`)
      return
    }
    decisions.push(payload)
  })

  return {
    schemaVersion: SELECTIVE_DECISIONS_AGGREGATE_SCHEMA_VERSION,
    decisions,
    warnings,
  }
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const aggregate = collectSelectiveDecisions({
    schemaFile: args.schemaFile,
    validatorFile: args.validatorFile,
  })

  const outputPath = path.resolve(process.cwd(), args.outputFile)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(aggregate, null, 2), 'utf8')
  console.log(`selective decisions collected: ${aggregate.decisions.length} decisions, ${aggregate.warnings.length} warnings.`)
}

if (require.main === module) {
  main()
}

module.exports = {
  parseArgs,
  collectSelectiveDecisions,
}
