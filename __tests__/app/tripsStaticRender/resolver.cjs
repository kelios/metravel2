'use strict'
/* global require, module */

const fs = require('node:fs')
const path = require('node:path')

// RN 0.88 dropped `@react-native/assets-registry`; react-native-svg 15 web modules
// still import it. Metro (SDK 58 `withMetroMultiPlatform`) aliases the legacy
// registry paths to `react-native-web/asset-registry` on web — mirror that alias.
const LEGACY_ASSET_REGISTRY = /^(?:@react-native\/assets-registry\/registry|react-native\/Libraries\/Image\/AssetRegistry)(?:\.js)?$/

// Jest's native preset otherwise resolves relative Expo imports to .native.
// Match Metro web resolution while retaining the actual package implementations.
module.exports = (request, options) => {
  if (LEGACY_ASSET_REGISTRY.test(request)) {
    return options.defaultResolver('react-native-web/asset-registry', options)
  }
  if (request.startsWith('.')) {
    for (const extension of ['.web.tsx', '.web.ts', '.web.js']) {
      const candidate = path.resolve(options.basedir, request + extension)
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return options.defaultResolver(request, options)
}
