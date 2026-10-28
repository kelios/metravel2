'use strict'

// This module is also bundled by the web async-require adapter: keep it free of Node APIs.
const VERSION = 'mc1'
const REGISTRY_KEY = '__METRAVEL_CHUNK_METADATA__'
const TABLE_MARKER = '/*__METRAVEL_CHUNK_TABLE__*/'
const validated = new WeakSet()
const decoded = new WeakMap()

function invalid(reason) {
  throw new Error(`Invalid web chunk metadata: ${reason}`)
}

function index(value, length, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value >= length) invalid(label)
}

function validateRegistry(table) {
  if (!table || typeof table !== 'object' || Array.isArray(table)) invalid('missing registry')
  if (validated.has(table)) return table
  if (table.v !== VERSION) invalid('registry version')
  if (!Array.isArray(table.f) || !Array.isArray(table.c) || !Array.isArray(table.m)) invalid('registry shape')
  if (typeof table.p !== 'string') invalid('global prefix')
  if (table.f.some((file) => typeof file !== 'string' || !file)) invalid('file URL')
  if (new Set(table.f).size !== table.f.length) invalid('duplicate file URL')
  const closures = new Set()
  for (const closure of table.c) {
    if (!Array.isArray(closure) || !closure.length) invalid('closure shape')
    for (const file of closure) index(file, table.f.length, 'file index')
    if (new Set(closure).size !== closure.length) invalid('duplicate closure file')
    const key = JSON.stringify(closure)
    if (closures.has(key)) invalid('duplicate closure')
    closures.add(key)
  }
  const maps = new Set()
  for (const map of table.m) {
    if (!map || typeof map !== 'object' || Array.isArray(map) || !Object.keys(map).length) invalid('map shape')
    for (const [id, closure] of Object.entries(map)) {
      if (!/^(0|[1-9]\d*)$/.test(id) || !Number.isSafeInteger(Number(id))) invalid('module ID')
      index(closure, table.c.length, 'closure index')
    }
    const key = JSON.stringify(map)
    if (maps.has(key)) invalid('duplicate map')
    maps.add(key)
  }
  validated.add(table)
  return table
}

function expandPaths(paths, table) {
  // Original Expo dependency-map objects, scalar worker targets and null are unchanged.
  if (!Array.isArray(paths)) return paths
  if (paths.length !== 2 || paths[0] !== VERSION) invalid('descriptor version or shape')
  validateRegistry(table)
  index(paths[1], table.m.length, 'map index')
  let maps = decoded.get(table)
  if (!maps) {
    maps = new Map()
    decoded.set(table, maps)
  }
  if (!maps.has(paths[1])) {
    const out = Object.create(null)
    for (const [id, closure] of Object.entries(table.m[paths[1]])) {
      out[id] = table.c[closure].map((file) => table.f[file])
    }
    maps.set(paths[1], out)
  }
  return maps.get(paths[1])
}

function expandGlobalPaths(paths, globals, prefix) {
  if (!Array.isArray(paths)) return paths
  const table = globals[`${prefix}${REGISTRY_KEY}`]
  if (table && table.p !== prefix) invalid('registry global prefix')
  return expandPaths(paths, table)
}

module.exports = { VERSION, REGISTRY_KEY, TABLE_MARKER, validateRegistry, expandPaths, expandGlobalPaths }
