'use strict'

const fs = require('fs')
const path = require('path')
const { parseStrictJson, parseRevisionReceipt, SHA, sha256 } = require('./questSeoContract')

const MAX_INPUT_BYTES = 128 * 1024 ** 2
const MAX_ENTRIES = 50000
const KEYS = ['questSeoReceipt', 'quests', 'questBundles', 'travels', 'travelDetails', 'articles', 'localizedBundles', 'rawTravelDetails']
function require_(ok, message) { if (!ok) throw new Error(`SEO inputs: ${message}`) }
function validateIdentity(identity) {
  require_(identity && Object.keys(identity).sort().join() === ['nonce', 'frontend_sha', 'api_origin', 'publication_mode'].sort().join(), 'identity keys')
  require_(/^[a-f0-9]{48}$/.test(identity.nonce) && SHA.test(identity.frontend_sha), 'build identity')
  require_(['ru-only', 'translations'].includes(identity.publication_mode), 'publication mode')
  const origin = new URL(identity.api_origin)
  require_(['http:', 'https:'].includes(origin.protocol) && origin.origin === identity.api_origin, 'API origin')
}
function validateInputs(inputs, identity) {
  require_(inputs && Object.keys(inputs).sort().join() === [...KEYS].sort().join(), 'payload keys')
  const receipt = parseRevisionReceipt(JSON.stringify(inputs.questSeoReceipt))
  for (const key of KEYS.filter(key => key !== 'questSeoReceipt')) {
    require_(Array.isArray(inputs[key]) && inputs[key].length <= MAX_ENTRIES, `bounded ${key}`)
  }
  for (const key of ['questBundles', 'travelDetails', 'localizedBundles', 'rawTravelDetails']) {
    const entries = inputs[key]
    require_(entries.every(entry => Array.isArray(entry) && entry.length === 2 && entry[1] && typeof entry[1] === 'object'), `invalid ${key}`)
    require_(new Set(entries.map(entry => String(entry[0]))).size === entries.length, `duplicate ${key}`)
  }
  for (const [url] of inputs.rawTravelDetails) {
    const parsed = new URL(url)
    require_(parsed.origin === identity.api_origin && parsed.href === url && !parsed.search && !parsed.hash
      && /^\/api\/travels\/[1-9][0-9]*\/$/.test(parsed.pathname), 'raw travel detail URL')
  }
  const expected = identity.publication_mode === 'translations' ? receipt.quests.flatMap(record =>
    ['be', 'uk', 'pl', 'en'].filter(locale => record.locales[locale].published && record.locales[locale].complete)
      .map(locale => `${locale}/${record.quest_slug}`)).sort() : []
  require_(JSON.stringify(inputs.localizedBundles.map(entry => entry[0]).sort()) === JSON.stringify(expected), 'incomplete exact-lang set')
  return receipt
}
function privateParent(file) {
  require_(path.isAbsolute(file), 'absolute private path required')
  const parent = path.dirname(file)
  require_(fs.realpathSync(parent) === parent, 'symlinked private parent')
  const stat = fs.lstatSync(parent)
  require_(stat.isDirectory() && (stat.mode & 0o777) === 0o700 && stat.uid === process.getuid(), 'private parent mode/owner')
}
function writeSeoInputs(file, identity, inputs) {
  validateIdentity(identity)
  const receipt = validateInputs(inputs, identity)
  privateParent(file)
  const payload = JSON.stringify(inputs)
  require_(Buffer.byteLength(payload) < MAX_INPUT_BYTES - 8192, 'payload exceeds bound')
  const body = JSON.stringify({ schema_version: 1, identity, receipt_digest: receipt.receipt_digest,
    payload_sha256: sha256(payload), inputs }) + '\n'
  require_(Buffer.byteLength(body) <= MAX_INPUT_BYTES, 'capture exceeds bound')
  const temporary = `${file}.partial`
  const fd = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600)
  try { fs.writeFileSync(fd, body); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  try { fs.linkSync(temporary, file) } finally { fs.unlinkSync(temporary) }
  const parent = fs.openSync(path.dirname(file), fs.constants.O_RDONLY)
  try { fs.fsyncSync(parent) } finally { fs.closeSync(parent) }
}
function readSeoInputs(file, expectedIdentity) {
  validateIdentity(expectedIdentity)
  privateParent(file)
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK)
  try {
    const before = fs.fstatSync(fd)
    require_(before.isFile() && before.nlink === 1 && before.uid === process.getuid()
      && (before.mode & 0o777) === 0o600 && before.size > 0 && before.size <= MAX_INPUT_BYTES, 'private regular bounded file required')
    // Allocate from the checked size, never from a concurrently growing file.
    // The final byte probe refuses growth without buffering any appended body.
    const bytes = Buffer.allocUnsafe(before.size)
    let offset = 0
    while (offset < bytes.length) {
      const count = fs.readSync(fd, bytes, offset, bytes.length - offset, null)
      require_(count > 0, 'capture truncated while reading')
      offset += count
    }
    require_(fs.readSync(fd, Buffer.alloc(1), 0, 1, null) === 0, 'capture grew while reading')
    const raw = bytes.toString('utf8')
    const after = fs.fstatSync(fd), named = fs.lstatSync(file)
    require_(['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs', 'mode', 'nlink'].every(key => before[key] === after[key] && after[key] === named[key]), 'capture changed while reading')
    const value = parseStrictJson(raw, 'SEO inputs')
    require_(Object.keys(value).sort().join() === ['schema_version', 'identity', 'receipt_digest', 'payload_sha256', 'inputs'].sort().join(), 'capture keys')
    require_(value.schema_version === 1 && JSON.stringify(value.identity) === JSON.stringify(expectedIdentity), 'capture belongs to another build')
    const receipt = validateInputs(value.inputs, expectedIdentity)
    require_(value.receipt_digest === receipt.receipt_digest && value.payload_sha256 === sha256(JSON.stringify(value.inputs)), 'capture digest mismatch')
    return value.inputs
  } finally { fs.closeSync(fd) }
}
module.exports = { MAX_INPUT_BYTES, validateIdentity, validateInputs, writeSeoInputs, readSeoInputs }
