'use strict'

const { parse } = require('@babel/parser')
const { REGISTRY_KEY, TABLE_MARKER, validateRegistry, expandPaths } = require('./webChunkMetadataRuntime')
const { COMPLETION_KEY } = require('./webChunkMetadataCodec')
const LEGACY_COMPLETION_KEY = '__expo_chunk_completion__'
const LEGACY_COMPLETION_SOURCE = `(function(){var s=typeof document!=="undefined"&&document.currentScript;if(s&&s.namespaceURI==="http://www.w3.org/1999/xhtml"&&s.tagName==="SCRIPT"&&typeof s.src==="string"&&s.src){var k="${LEGACY_COMPLETION_KEY}";(globalThis[k]||(globalThis[k]=new Set())).add(s.src);}})();`
const AST_LAYOUT_KEYS = new Set(['start', 'end', 'loc', 'extra', 'leadingComments', 'innerComments', 'trailingComments'])
function completionFingerprint(node, registryKey = LEGACY_COMPLETION_KEY) {
  return JSON.stringify(node, (key, value) => AST_LAYOUT_KEYS.has(key) ? undefined
    : key === 'value' && value === registryKey ? LEGACY_COMPLETION_KEY : value)
}
const legacyCompletionFingerprint = completionFingerprint(parse(LEGACY_COMPLETION_SOURCE).program.body[0].expression)
function isLegacyCompletion(expression) {
  // Normalize only the generated registry key; every other AST node must match.
  const key = expression.callee?.body?.body?.[1]?.consequent?.body?.[0]?.declarations?.[0]?.init
  return key?.type === 'StringLiteral' && key.value.endsWith(LEGACY_COMPLETION_KEY)
    && completionFingerprint(expression, key.value) === legacyCompletionFingerprint
}

// Page-shell processing reuses chunks on many routes. Retain only parsed data/ranges,
// not factory ASTs; the bounded cache avoids parsing the same multi-MB entry repeatedly.
const cache = new Map()
function globalKey(node) {
  return node?.type === 'MemberExpression' && node.computed
    && node.object.type === 'Identifier' && node.object.name === 'globalThis'
    && node.property.type === 'StringLiteral' ? node.property.value : null
}
function analyze(source) {
  if (cache.has(source)) return cache.get(source)
  const result = { modules: [], roots: [], registries: [], completions: [], legacyCompletions: [] }
  const body = parse(source, { sourceType: 'script', allowReturnOutsideFunction: true }).program.body
  for (const statement of body) {
    const expression = statement.type === 'ExpressionStatement' ? statement.expression : null
    if (expression?.type === 'AssignmentExpression' && expression.operator === '=') {
      const key = globalKey(expression.left)
      if (key?.endsWith(REGISTRY_KEY)
          && source.slice(expression.left.end, expression.right.start).includes(TABLE_MARKER)) {
        result.registries.push({ key, raw: source.slice(expression.right.start, expression.right.end) })
      }
    }
    if (expression?.type !== 'CallExpression') continue
    if (expression.callee.type === 'FunctionExpression' && isLegacyCompletion(expression)) {
      result.legacyCompletions.push([statement.start, statement.end])
      continue
    }
    if (expression.callee.type === 'Identifier' && expression.callee.name.endsWith('__r')
        && expression.arguments[0]?.type === 'NumericLiteral') result.roots.push(expression.arguments[0].value)
    const completion = globalKey(expression.callee)
    if (completion?.endsWith(COMPLETION_KEY) && expression.arguments.length === 0) {
      result.completions.push({ key: completion, start: statement.start, end: statement.end })
      continue
    }
    if (expression.callee.type !== 'Identifier' || !expression.callee.name.endsWith('__d')
        || !['FunctionExpression', 'ArrowFunctionExpression'].includes(expression.arguments[0]?.type)
        || expression.arguments[1]?.type !== 'NumericLiteral'
        || !['ObjectExpression', 'ArrayExpression'].includes(expression.arguments[2]?.type)) continue
    const node = expression.arguments[2]
    let map
    try { map = JSON.parse(source.slice(node.start, node.end)) } catch {
      throw new Error('Invalid Metro chunk dependency map: expected emitted JSON')
    }
    let range
    if (node.type === 'ObjectExpression') {
      for (let i = 0; i < node.properties.length; i += 1) {
        const property = node.properties[i]
        if (property.type !== 'ObjectProperty' || property.computed
            || (property.key.value ?? property.key.name) !== 'paths') continue
        if (range) throw new Error('Invalid Metro chunk dependency map: duplicate paths')
        if (property.value.type === 'ObjectExpression') {
          const keys = property.value.properties.map((entry) => entry.key?.value ?? entry.key?.name)
          if (new Set(keys).size !== keys.length) throw new Error('Invalid legacy chunk paths: duplicate module ID')
        }
        range = i > 0 ? [node.properties[i - 1].end, property.end]
          : [property.start, node.properties[i + 1]?.start ?? property.end]
      }
    }
    result.modules.push({ id: expression.arguments[1].value, map, range })
  }
  if (cache.size >= 256) cache.delete(cache.keys().next().value)
  cache.set(source, result)
  return result
}

/** Parse only a real top-level assignment, never code-looking text inside an app string. */
function readChunkMetadataRegistry(source) {
  if (!source.includes(TABLE_MARKER)) return null
  let table = null
  for (const assignment of analyze(source).registries) {
    if (table) throw new Error('Duplicate web chunk metadata registry')
    try { table = JSON.parse(assignment.raw) } catch {
      throw new Error('Invalid web chunk metadata: registry must be JSON')
    }
    validateRegistry(table)
    if (assignment.key !== `${table.p}${REGISTRY_KEY}`) throw new Error('Invalid web chunk metadata: registry global prefix')
  }
  return table
}
function registryFromSources(sources) {
  let registry = null
  for (const source of sources) {
    const table = readChunkMetadataRegistry(source)
    if (!table) continue
    if (registry) throw new Error('Duplicate web chunk metadata registry')
    registry = table
  }
  return registry
}
function moduleDependencyMaps(source) {
  return analyze(source).modules
}
function moduleRoots(source) {
  return analyze(source).roots
}
function hasCompactChunkMetadata(source) {
  const parsed = analyze(source)
  return parsed.modules.some((module) => Array.isArray(module.map.paths)) || parsed.completions.length > 0
}

function validateLegacyPaths(paths) {
  if (!paths || typeof paths !== 'object' || Array.isArray(paths)) throw new Error('Invalid legacy chunk paths: expected object')
  for (const [id, files] of Object.entries(paths)) {
    if (!/^(0|[1-9]\d*)$/.test(id) || !Number.isSafeInteger(Number(id))
        || !(typeof files === 'string' || Array.isArray(files) && files.every((file) => typeof file === 'string'))) {
      throw new Error('Invalid legacy chunk paths: expected module IDs and string or string-array targets')
    }
  }
}

/** Exclude validated loader data only from real Metro parameters and known top-level completions. */
function stripCompactChunkMetadata(source, registry) {
  if (!source.includes('paths') && !source.includes(LEGACY_COMPLETION_KEY) && !source.includes(COMPLETION_KEY)) return source
  const parsed = analyze(source)
  const ranges = parsed.legacyCompletions.slice()
  for (const module of parsed.modules) {
    if (!module.range) continue
    if (Array.isArray(module.map.paths)) expandPaths(module.map.paths, registry)
    else validateLegacyPaths(module.map.paths)
    ranges.push(module.range)
  }
  for (const completion of parsed.completions) {
    validateRegistry(registry)
    if (completion.key !== `${registry.p}${COMPLETION_KEY}`) throw new Error('Invalid web chunk metadata: completion prefix')
    ranges.push([completion.start, completion.end])
  }
  for (const [start, end] of ranges.sort((a, b) => b[0] - a[0])) source = source.slice(0, start) + source.slice(end)
  return source
}

module.exports = { readChunkMetadataRegistry, registryFromSources, moduleDependencyMaps, moduleRoots, hasCompactChunkMetadata, stripCompactChunkMetadata }
