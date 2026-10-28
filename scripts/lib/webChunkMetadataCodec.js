'use strict'

const path = require('node:path')
const CountingSet = require('@expo/metro/metro/lib/CountingSet').default
const { VERSION, REGISTRY_KEY, TABLE_MARKER, validateRegistry, expandPaths } = require('./webChunkMetadataRuntime')

// Versioned private symbol is repeated in every async chunk, like Metro's __d/__r.
const COMPLETION_KEY = '__mtc1'

function virtualScript(code) {
  return {
    path: 'metravel-chunk-metadata',
    dependencies: new Map(),
    inverseDependencies: new CountingSet(),
    getSource: () => Buffer.from(code),
    output: [{ type: 'js/script/virtual', data: { code, lineCount: code.split('\n').length, map: [] } }],
  }
}

/** Intern exact maps of module ID -> ordered target-chunk arrays. */
function createCodec(records, targetKey, prefix = '') {
  const targets = [...new Set(records.flatMap(({ paths }) => Object.values(paths).flat()))]
    .sort((a, b) => targetKey(a).localeCompare(targetKey(b), 'en'))
  const fileIds = new Map(targets.map((target, id) => [target, id]))
  const closureKeys = [...new Set(records.flatMap(({ paths }) => Object.values(paths)
    .map((files) => JSON.stringify(files.map((target) => fileIds.get(target))))))].sort()
  const closureIds = new Map(closureKeys.map((key, id) => [key, id]))
  const mapOf = (record) => Object.fromEntries(Object.entries(record.paths)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, files]) => [id, closureIds.get(JSON.stringify(files.map((target) => fileIds.get(target))))]))
  const mapKeys = [...new Set(records.map((record) => JSON.stringify(mapOf(record))))].sort()
  const mapIds = new Map(mapKeys.map((key, id) => [key, id]))
  const recordIds = new Map(records.map((record) => [record, mapIds.get(JSON.stringify(mapOf(record)))]))
  const table = (fileName) => ({
    v: VERSION,
    f: targets.map(fileName),
    c: closureKeys.map((key) => JSON.parse(key)),
    m: mapKeys.map((key) => JSON.parse(key)),
    p: prefix,
  })
  const stable = table(targetKey)
  validateRegistry(stable)
  return { targets, recordIds, table, stable }
}

function prelude(table) {
  const registryKey = JSON.stringify(`${table.p}${REGISTRY_KEY}`)
  const completionKey = JSON.stringify(`${table.p}${COMPLETION_KEY}`)
  const expoCompletionKey = JSON.stringify(`${table.p}__expo_chunk_completion__`)
  return `globalThis[${registryKey}]=${TABLE_MARKER}${JSON.stringify(table)};globalThis[${completionKey}]=function(){var s=typeof document!=="undefined"&&document.currentScript;if(s&&s.namespaceURI==="http://www.w3.org/1999/xhtml"&&s.tagName==="SCRIPT"&&typeof s.src==="string"&&s.src){var k=${expoCompletionKey};(globalThis[k]||(globalThis[k]=new Set())).add(s.src);}};`
}

/** Called after granular materialization/ID allocation, before Expo computes filenames. */
function prepareWebChunkMetadata(chunks, context, chunksByPath) {
  const ordered = [...chunks]
  const runtime = ordered.find((chunk) => chunk.isVendor && chunk.name === '/__expo-metro-runtime.js')
  if (!runtime || context.serializeChunkOptions?.chunkingStrategy !== 'granular'
      || context.options.dev || context.graph.transformOptions.platform !== 'web'
      || (context.graph.transformOptions.customTransformOptions?.environment ?? 'client') !== 'client'
      || !context.options.serializerOptions?.exporting) return
  const { getChunkUrl } = require('@expo/metro-config/build/serializer/exportPath')
  const { getBaseUrlOption } = require('@expo/metro-config/build/serializer/chunking/Chunk')
  const baseUrl = getBaseUrlOption(context.graph, context.options)
  const prefix = context.options.globalPrefix ?? ''
  const targetKey = (target) => target.name.startsWith('/__shared-') ? target.name.slice(1)
    : path.relative(context.options.projectRoot, target.name).replace(/\\/g, '/')
  // Placeholder filenames are data only; upstream still computes every real URL.
  const symbolicNames = new Map(ordered.map((chunk, id) => [chunk, `__metravel_symbolic_${id}.js`]))
  const symbolicTargets = new Map(ordered.map((chunk) => [getChunkUrl(baseUrl, symbolicNames.get(chunk)), chunk]))
  const records = []
  const byChunk = new Map()
  for (const chunk of ordered) {
    if (chunk.sealed || chunk === runtime) continue
    const serialize = chunk.strategy.getSerializationOptions(chunk, chunksByPath, symbolicNames)
    if (typeof serialize.unstable_getAsyncDependencyPath !== 'function') continue
    const modules = new Map()
    for (const module of [...chunk.deps].sort((a, b) => a.path.localeCompare(b.path, 'en'))) {
      const paths = {}
      let legacy = false
      for (const dependency of module.dependencies.values()) {
        if (!dependency.absolutePath || dependency.data.data.asyncType == null) continue
        const value = serialize.unstable_getAsyncDependencyPath(dependency)
        if (value == null) continue
        // Worker/scalar imports retain the complete original per-module representation.
        if (!Array.isArray(value)) { legacy = true; break }
        const targets = value.map((url) => {
          const target = symbolicTargets.get(url)
          if (!target) throw new Error(`Unknown symbolic web chunk target: ${url}`)
          return target
        })
        paths[context.options.createModuleId(dependency.absolutePath)] = targets
      }
      if (legacy || !Object.keys(paths).length) continue
      const record = { chunk, module, paths }
      records.push(record)
      modules.set(module, record)
    }
    byChunk.set(chunk, modules)
  }
  if (!records.length) return
  const codec = createCodec(records, targetKey, prefix)
  const completion = `globalThis[${JSON.stringify(`${prefix}${COMPLETION_KEY}`)}]();`
  const tables = new WeakMap()
  const getTable = (filenames) => {
    if (!filenames) return codec.stable
    if (!tables.has(filenames)) {
      tables.set(filenames, codec.table((target) => {
        const filename = filenames.get(target)
        if (!filename) throw new Error(`Missing compact web chunk filename: ${target.name}`)
        return getChunkUrl(baseUrl, filename)
      }))
    }
    return tables.get(filenames)
  }
  const plan = {
    getPrelude(chunk, filenames) {
      return chunk === runtime ? virtualScript(prelude(getTable(filenames))) : null
    },
    getSerializationOptions(chunk, filenames) {
      if (chunk.sealed) return {}
      return {
        unstable_metravelChunkCompletion: completion,
        unstable_encodeAsyncPaths(module, actual) {
          const record = byChunk.get(chunk)?.get(module)
          if (!record) return undefined
          const descriptor = [VERSION, codec.recordIds.get(record)]
          if (filenames) {
            const expected = expandPaths(descriptor, getTable(filenames))
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
              throw new Error(`Compact web chunk paths differ from upstream metadata: ${module.path}`)
            }
          }
          return descriptor
        },
      }
    },
  }
  for (const chunk of ordered) if (!chunk.sealed) chunk.unstable_metravelChunkMetadata = plan
  // Only hashing uses these edges: delivery requirements and fetch sets stay upstream-owned.
  runtime.unstable_metravelHashTargets = codec.targets
}

module.exports = { createCodec, prepareWebChunkMetadata, prelude, COMPLETION_KEY }
