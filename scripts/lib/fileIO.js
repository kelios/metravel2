/**
 * scripts/lib/fileIO.js
 * Shared file I/O utilities for CI scripts.
 * Consolidates duplicated read/write helpers from validation-utils.js and summary-utils.js.
 */

const fs = require('fs')
const path = require('path')

/** Resolve a path relative to CWD */
const resolveFromCwd = (filePath) => {
  return path.resolve(process.cwd(), String(filePath || ''))
}

/** Read a text file, throw if not found */
const readTextFile = (filePath, label = 'file') => {
  const resolved = resolveFromCwd(filePath)
  if (!fs.existsSync(resolved)) {
    throw new Error(`${label} not found: ${filePath}`)
  }
  return fs.readFileSync(resolved, 'utf8')
}

/** Read a JSON file, throw if not found or invalid */
const readJsonFile = (filePath, label = 'file') => {
  return JSON.parse(readTextFile(filePath, label))
}

/** Read a JSON file with status (no throw) */
const readJsonFileWithStatus = (filePath) => {
  const resolved = resolveFromCwd(filePath)
  if (!fs.existsSync(resolved)) {
    return { ok: false, missing: true, payload: null }
  }
  try {
    return { ok: true, missing: false, payload: JSON.parse(fs.readFileSync(resolved, 'utf8')) }
  } catch (error) {
    return { ok: false, missing: false, payload: null, parseError: error instanceof Error ? error.message : String(error) }
  }
}

/** Write text to a file (creating dirs if needed) */
const writeTextFile = (filePath, content) => {
  const resolved = resolveFromCwd(filePath)
  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  fs.writeFileSync(resolved, content, 'utf8')
}

/** Write JSON to a file */
const writeJsonFile = (filePath, data) => {
  writeTextFile(filePath, JSON.stringify(data, null, 2) + '\n')
}

/** Check if file exists */
const fileExists = (filePath) => {
  return fs.existsSync(resolveFromCwd(filePath))
}

module.exports = {
  resolveFromCwd,
  readTextFile,
  readJsonFile,
  readJsonFileWithStatus,
  writeTextFile,
  writeJsonFile,
  fileExists,
}

