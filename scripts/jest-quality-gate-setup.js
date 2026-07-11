'use strict'

const { acquireQualityGateLock } = require('./quality-gate-lock')

module.exports = async function jestQualityGateSetup() {
  const result = acquireQualityGateLock({ name: 'jest' })
  if (!result.reentrant) {
    console.log(`quality-gate-lock: acquired for direct Jest (pid=${process.pid})`)
  }
}
