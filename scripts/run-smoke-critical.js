const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { SMOKE_CRITICAL_TESTS } = require('./smoke-critical-tests')

const DEFAULT_CI_OUTPUT_FILE = 'test-results/jest-smoke-results.json'

const parseArgs = (argv) => {
  const args = {
    ci: false,
    outputFile: DEFAULT_CI_OUTPUT_FILE,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--ci') {
      args.ci = true
      continue
    }
    if (token === '--output-file') {
      const next = argv[i + 1]
      if (!next) {
        throw new Error('--output-file requires a value')
      }
      args.outputFile = next
      i += 1
      continue
    }
    throw new Error(`Unknown argument: ${token}`)
  }

  return args
}

const buildJestArgs = ({ ci, outputFile }) => {
  const args = ['jest', '--passWithNoTests', '--runInBand']
  if (ci) {
    args.push('--json', `--outputFile=${outputFile}`)
  }
  args.push(...SMOKE_CRITICAL_TESTS)
  return args
}

const runSmokeCritical = ({ ci, outputFile }) => {
  if (ci) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true })
  }

  const result = spawnSync('yarn', buildJestArgs({ ci, outputFile }), {
    stdio: 'inherit',
  })
  return result.status ?? 1
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const status = runSmokeCritical(args)
  if (status !== 0) {
    process.exit(status)
  }
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`run-smoke-critical: ${error.message}`)
    process.exit(2)
  }
}

module.exports = {
  DEFAULT_CI_OUTPUT_FILE,
  parseArgs,
  buildJestArgs,
  runSmokeCritical,
}
