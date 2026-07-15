'use strict'

const {
  acquireQualityGateLock,
  formatQualityGateSkipMessage,
  isQualityGateBusyError,
} = require('./quality-gate-lock')

module.exports = async function jestQualityGateSetup() {
  try {
    const result = acquireQualityGateLock({ name: 'jest' })
    if (!result.reentrant) {
      console.log(`quality-gate-lock: acquired for direct Jest (pid=${process.pid})`)
    }
  } catch (error) {
    if (!isQualityGateBusyError(error)) throw error
    console.log(formatQualityGateSkipMessage(error))
    process.exit(0)
  }
}
