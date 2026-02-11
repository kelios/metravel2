const SELECTIVE_DECISION_CONTRACT_VERSION = 1
const SELECTIVE_DECISIONS_AGGREGATE_SCHEMA_VERSION = 1

const validateSelectiveDecision = (payload) => {
  const errors = []
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ['Payload must be a JSON object.']
  }

  if (payload.contractVersion !== SELECTIVE_DECISION_CONTRACT_VERSION) {
    errors.push(`Field "contractVersion" must be ${SELECTIVE_DECISION_CONTRACT_VERSION}.`)
  }
  if (typeof payload.check !== 'string' || !payload.check.trim()) {
    errors.push('Field "check" must be a non-empty string.')
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
  if (typeof payload.relevantMatches !== 'number' || !Number.isFinite(payload.relevantMatches)) {
    errors.push('Field "relevantMatches" must be a finite number.')
  }
  if (!Array.isArray(payload.matchedFiles) || payload.matchedFiles.some((v) => typeof v !== 'string')) {
    errors.push('Field "matchedFiles" must be an array of strings.')
  }
  if (typeof payload.dryRun !== 'boolean') {
    errors.push('Field "dryRun" must be a boolean.')
  }
  if (typeof payload.targetedTests !== 'number' || !Number.isFinite(payload.targetedTests)) {
    errors.push('Field "targetedTests" must be a finite number.')
  }

  return errors
}

const validateSelectiveDecisionsAggregate = (payload) => {
  const errors = []
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ['Payload must be a JSON object.']
  }

  if (payload.schemaVersion !== SELECTIVE_DECISIONS_AGGREGATE_SCHEMA_VERSION) {
    errors.push(`Field "schemaVersion" must be ${SELECTIVE_DECISIONS_AGGREGATE_SCHEMA_VERSION}.`)
  }
  if (!Array.isArray(payload.decisions)) {
    errors.push('Field "decisions" must be an array.')
  } else {
    payload.decisions.forEach((decision, index) => {
      validateSelectiveDecision(decision).forEach((error) => {
        errors.push(`decisions[${index}]: ${error}`)
      })
    })
  }
  if (!Array.isArray(payload.warnings) || payload.warnings.some((v) => typeof v !== 'string')) {
    errors.push('Field "warnings" must be an array of strings.')
  }

  return errors
}

module.exports = {
  SELECTIVE_DECISION_CONTRACT_VERSION,
  SELECTIVE_DECISIONS_AGGREGATE_SCHEMA_VERSION,
  validateSelectiveDecision,
  validateSelectiveDecisionsAggregate,
}
