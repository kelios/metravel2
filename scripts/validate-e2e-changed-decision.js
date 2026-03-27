const fs = require('fs')
const path = require('path')

const validateE2EChangedDecision = (payload) => {
  const errors = []
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ['Payload must be a JSON object.']
  }

  if (payload.contractVersion !== 1) {
    errors.push('Field "contractVersion" must be 1.')
  }
  if (payload.check !== 'e2e-changed') {
    errors.push('Field "check" must equal "e2e-changed".')
  }
  if (typeof payload.source !== 'string' || !payload.source.trim()) {
    errors.push('Field "source" must be a non-empty string.')
  }
  if (payload.decision !== 'run' && payload.decision !== 'skip') {
    errors.push('Field "decision" must be "run" or "skip".')
  }
  if (typeof payload.shouldRun !== 'boolean') {
    errors.push('Field "shouldRun" must be a boolean.')
  }
  if (typeof payload.reason !== 'string' || !payload.reason.trim()) {
    errors.push('Field "reason" must be a non-empty string.')
  }
  if (typeof payload.changedFilesScanned !== 'number' || !Number.isFinite(payload.changedFilesScanned)) {
    errors.push('Field "changedFilesScanned" must be a finite number.')
  }
  if (!Array.isArray(payload.matchedCategories) || payload.matchedCategories.some((v) => typeof v !== 'string')) {
    errors.push('Field "matchedCategories" must be an array of strings.')
  }
  if (typeof payload.specCount !== 'number' || !Number.isFinite(payload.specCount)) {
    errors.push('Field "specCount" must be a finite number.')
  }
  if (!Array.isArray(payload.specs) || payload.specs.some((v) => typeof v !== 'string')) {
    errors.push('Field "specs" must be an array of strings.')
  }
  if (typeof payload.dryRun !== 'boolean') {
    errors.push('Field "dryRun" must be a boolean.')
  }
  if (payload.shouldRun !== (payload.decision === 'run')) {
    errors.push('Field "shouldRun" must stay aligned with "decision".')
  }
  if (payload.specCount !== payload.specs.length) {
    errors.push('Field "specCount" must equal specs.length.')
  }

  return errors
}

const main = () => {
  const inputPath = process.argv.includes('--file')
    ? process.argv[process.argv.indexOf('--file') + 1]
    : 'test-results/e2e-changed-decision.json'
  const resolved = path.resolve(process.cwd(), inputPath)
  if (!fs.existsSync(resolved)) {
    console.error(`e2e-changed decision validation failed: file not found: ${inputPath}`)
    process.exit(1)
  }

  let payload
  try {
    payload = JSON.parse(fs.readFileSync(resolved, 'utf8'))
  } catch (error) {
    console.error(`e2e-changed decision validation failed: cannot parse JSON: ${String(error)}`)
    process.exit(1)
  }

  const errors = validateE2EChangedDecision(payload)
  if (errors.length > 0) {
    console.error('e2e-changed decision validation failed:')
    errors.forEach((error) => console.error(`- ${error}`))
    process.exit(1)
  }

  console.log('e2e-changed decision validation passed.')
}

if (require.main === module) {
  main()
}

module.exports = {
  validateE2EChangedDecision,
}
