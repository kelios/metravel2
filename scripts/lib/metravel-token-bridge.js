'use strict'

// Secret result is written only to an inherited private fd, never stdout/argv.
const fs = require('node:fs')
const { createToolSession, TokenError, formatTokenError } = require('./metravel-tool-session')
const MAX_FRAME = 16 * 1024

function readFrame(stream) {
  return new Promise((resolve, reject) => {
    let bytes = Buffer.alloc(0)
    stream.on('data', (chunk) => {
      bytes = Buffer.concat([bytes, chunk])
      if (bytes.length > MAX_FRAME + 4 || (bytes.length >= 4 && bytes.readUInt32BE(0) > MAX_FRAME)) {
        stream.destroy(); reject(new TokenError('configuration'))
      }
    })
    stream.on('error', () => reject(new TokenError('configuration')))
    stream.on('end', () => {
      try {
        if (bytes.length < 4 || bytes.readUInt32BE(0) !== bytes.length - 4) throw new Error()
        const frame = JSON.parse(bytes.subarray(4).toString('utf8'))
        if (!frame || frame.v !== 1 || frame.op !== 'token' || frame.profile !== 'owner' || frame.expectedUserId !== 1 || typeof frame.origin !== 'string') throw new Error()
        resolve(frame)
      } catch { reject(new TokenError('configuration')) }
    })
  })
}

async function main() {
  const descriptor = Number(process.argv[2])
  if (process.argv.length !== 3 || !Number.isInteger(descriptor) || descriptor < 3) throw new TokenError('configuration')
  const timer = setTimeout(() => { process.stderr.write('metravel-auth: request/timeout\n'); process.exit(1) }, 40000)
  try {
    const frame = await readFrame(process.stdin)
    const token = await createToolSession({ origin: frame.origin, profile: 'owner', expectedUserId: 1 }).ensureToken()
    const result = Buffer.from(JSON.stringify({ v: 1, token, userId: 1 }), 'utf8')
    if (result.length > MAX_FRAME) throw new TokenError('response')
    const header = Buffer.alloc(4); header.writeUInt32BE(result.length)
    fs.writeFileSync(descriptor, Buffer.concat([header, result]))
    fs.closeSync(descriptor)
  } finally { clearTimeout(timer) }
}

if (require.main === module) main().catch((error) => { process.stderr.write(`${formatTokenError(error)}\n`); process.exitCode = 1 })
module.exports = { readFrame, MAX_FRAME }
