const { parseFileArg, readJsonFile } = require('./validation-utils')
const { validateSelectiveDecisionsAggregate } = require('./selective-decision-contract')

const main = () => {
  const args = parseFileArg(process.argv.slice(2), 'test-results/selective-decisions.json')
  let payload

  try {
    payload = readJsonFile(args.file, 'selective decisions aggregate file')
  } catch (error) {
    console.error(`selective decisions aggregate validation failed: ${String(error.message || error)}`)
    process.exit(1)
  }

  const errors = validateSelectiveDecisionsAggregate(payload)
  if (errors.length > 0) {
    console.error('selective decisions aggregate validation failed:')
    errors.forEach((e) => console.error(`- ${e}`))
    process.exit(1)
  }

  console.log('selective decisions aggregate validation passed.')
}

if (require.main === module) {
  main()
}

module.exports = {
  validateSelectiveDecisionsAggregate,
}
