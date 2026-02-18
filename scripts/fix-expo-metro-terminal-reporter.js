/**
 * Some tooling uses ESM dynamic import() with an absolute file path that omits
 * the `.js` extension, e.g.:
 *   /.../node_modules/@expo/metro/metro/lib/TerminalReporter
 *
 * Node's ESM resolver does not add extensions for file-specifiers, so the import
 * fails even though TerminalReporter.js exists.
 *
 * This script creates an extensionless shim file that re-exports the `.js` file.
 */

const fs = require('fs')
const path = require('path')

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

function ensureShim() {
  const projectRoot = path.resolve(__dirname, '..')
  const libDir = path.join(projectRoot, 'node_modules', '@expo', 'metro', 'metro', 'lib')
  const jsTarget = path.join(libDir, 'TerminalReporter.js')
  const shimTarget = path.join(libDir, 'TerminalReporter')

  if (!fileExists(libDir) || !fileExists(jsTarget)) return { created: false, reason: 'missing' }
  if (fileExists(shimTarget)) return { created: false, reason: 'exists' }

  const shim = 'module.exports = require("./TerminalReporter.js")\n'
  fs.writeFileSync(shimTarget, shim, { encoding: 'utf8', flag: 'wx' })
  return { created: true, reason: 'created' }
}

try {
  const result = ensureShim()
  if (result.created) {
    // Keep output minimal but visible in install logs when a fix was applied.
    console.log('[postinstall] Added shim: @expo/metro/metro/lib/TerminalReporter')
  }
} catch (err) {
  console.warn('[postinstall] Failed to add TerminalReporter shim:', err && err.message ? err.message : err)
}
