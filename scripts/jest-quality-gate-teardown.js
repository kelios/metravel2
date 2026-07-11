'use strict'

const { releaseQualityGateLock } = require('./quality-gate-lock')

module.exports = async function jestQualityGateTeardown() {
  releaseQualityGateLock()
}
