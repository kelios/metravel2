'use strict'

const fs = require('fs')
const path = require('path')

function readOptionalSecretToken() {
  if (process.env.YANDEX_METRIKA_TOKEN) return process.env.YANDEX_METRIKA_TOKEN.trim()
  for (const name of ['yandex-metrika-token', 'yandex-metrika-token.txt']) {
    try {
      const token = fs.readFileSync(path.resolve(__dirname, '../../.secrets', name), 'utf8').trim()
      if (token) return token
    } catch {
      // Optional credentials: absence and unreadable files are both unconfigured.
    }
  }
  return ''
}

module.exports = { readOptionalSecretToken }
