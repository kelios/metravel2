const nowUtc = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

const parseArgs = (argv) => {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      out[key] = 'true'
      continue
    }
    out[key] = next
    i += 1
  }
  return out
}

const valueOrPlaceholder = (value, placeholder) => {
  const v = String(value || '').trim()
  return v || placeholder
}

const buildIncidentMarkdown = (params = {}) => {
  const failureClass = valueOrPlaceholder(
    params.failureClass,
    '<infra_artifact|inconsistent_state|lint_only|smoke_only|mixed|performance_budget|selective_contract|validator_contract>'
  )
  const recommendationId = valueOrPlaceholder(params.recommendationId, '<QG-001..QG-008>')
  const workflowRun = valueOrPlaceholder(params.workflowRun, '<link>')
  const branchOrPr = valueOrPlaceholder(params.branchOrPr, '<branch-or-pr-link>')
  const impact = valueOrPlaceholder(params.impact, '<what is blocked / affected>')
  const owner = valueOrPlaceholder(params.owner, '<person-or-team>')
  const eta = valueOrPlaceholder(params.eta, '<expected resolution time>')
  const immediateAction = valueOrPlaceholder(params.immediateAction, '<one-line summary>')
  const followUp = valueOrPlaceholder(params.followUp, '<yes/no + short note>')
  const selectiveArtifact = String(params.selectiveArtifact || '').trim()
  const validatorArtifact = String(params.validatorArtifact || '').trim()
  const dateUtc = valueOrPlaceholder(params.dateUtc, nowUtc())

  return [
    '### CI Smoke Incident',
    `- Date (UTC): ${dateUtc}`,
    `- Workflow run: ${workflowRun}`,
    `- Branch / PR: ${branchOrPr}`,
    `- Failure Class: ${failureClass}`,
    `- Recommendation ID: ${recommendationId}`,
    `- Impact: ${impact}`,
    `- Owner: ${owner}`,
    `- ETA: ${eta}`,
    `- Immediate action taken: ${immediateAction}`,
    `- Follow-up required: ${followUp}`,
    ...(selectiveArtifact ? [`- Selective decisions artifact: ${selectiveArtifact}`] : []),
    ...(validatorArtifact ? [`- Validator contracts artifact: ${validatorArtifact}`] : []),
    '',
  ].join('\n')
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const markdown = buildIncidentMarkdown({
    dateUtc: args['date-utc'],
    workflowRun: args['workflow-run'],
    branchOrPr: args['branch-pr'],
    failureClass: args['failure-class'],
    recommendationId: args['recommendation-id'],
    impact: args.impact,
    owner: args.owner,
    eta: args.eta,
    immediateAction: args['immediate-action'],
    followUp: args['follow-up'],
    selectiveArtifact: args['artifact-url'],
    validatorArtifact: args['validator-artifact-url'],
  })

  process.stdout.write(markdown)
}

if (require.main === module) {
  main()
}

module.exports = {
  parseArgs,
  buildIncidentMarkdown,
}
