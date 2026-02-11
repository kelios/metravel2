const { parseFileArg, readJsonFile } = require('./validation-utils')
const { validateSelectiveDecision } = require('./selective-decision-contract')

const main = () => {
  const args = parseFileArg(process.argv.slice(2), 'test-results/selective-decision.json')
  let payload

  try {
    payload = readJsonFile(args.file, 'selective decision file')
  } catch (error) {
    console.error(`selective decision validation failed: ${String(error.message || error)}`)
    process.exit(1)
  }

  const errors = validateSelectiveDecision(payload)
  if (errors.length > 0) {
    console.error('selective decision validation failed:')
    errors.forEach((e) => console.error(`- ${e}`))
    process.exit(1)
  }

  console.log('selective decision validation passed.')
}

if (require.main === module) {
  main()
}

module.exports = {
  validateSelectiveDecision,
}
