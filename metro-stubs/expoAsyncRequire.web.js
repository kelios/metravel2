'use strict'
/* global __METRO_GLOBAL_PREFIX__ */

// The resolver bypasses this adapter's own original import. Expo remains the loader owner.
const original = require('expo/internal/async-require-module')
const { expandGlobalPaths } = require('../scripts/lib/webChunkMetadataRuntime')

function paths(value) {
  const prefix = typeof __METRO_GLOBAL_PREFIX__ === 'string' ? __METRO_GLOBAL_PREFIX__ : ''
  return expandGlobalPaths(value, globalThis, prefix)
}

function asyncRequire(moduleID, dependencyPaths, moduleName) {
  // Return Expo's exact promise, including its _result field.
  return original(moduleID, paths(dependencyPaths), moduleName)
}

Object.assign(asyncRequire, original)
asyncRequire.unstable_importMaybeSync = (moduleID, dependencyPaths) =>
  original.unstable_importMaybeSync(moduleID, paths(dependencyPaths))
asyncRequire.prefetch = (moduleID, dependencyPaths, moduleName) =>
  original.prefetch(moduleID, paths(dependencyPaths), moduleName)
asyncRequire.unstable_resolve = (moduleID, dependencyPaths) =>
  original.unstable_resolve(moduleID, paths(dependencyPaths))

module.exports = asyncRequire
