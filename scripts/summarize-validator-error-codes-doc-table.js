const { ERROR_CODES } = require('./validator-error-codes')

const buildErrorCodesTable = (errorCodes = ERROR_CODES) => {
  const lines = [
    '| Namespace | Key | Code |',
    '| --- | --- | --- |',
  ]

  for (const [namespace, entries] of Object.entries(errorCodes || {})) {
    for (const [key, code] of Object.entries(entries || {})) {
      lines.push(`| ${namespace} | ${key} | ${String(code)} |`)
    }
  }

  return `${lines.join('\n')}\n`
}

const main = () => {
  process.stdout.write(buildErrorCodesTable(ERROR_CODES))
}

if (require.main === module) {
  main()
}

module.exports = {
  buildErrorCodesTable,
}
