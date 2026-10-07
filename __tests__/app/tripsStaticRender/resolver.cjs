'use strict'
/* global require, module */

const fs = require('node:fs')
const path = require('node:path')

// Jest's native preset otherwise resolves relative Expo imports to .native.
// Match Metro web resolution while retaining the actual package implementations.
module.exports = (request, options) => {
  if (request.startsWith('.')) {
    for (const extension of ['.web.tsx', '.web.ts', '.web.js']) {
      const candidate = path.resolve(options.basedir, request + extension)
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return options.defaultResolver(request, options)
}
