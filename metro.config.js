// @ts-nocheck
// Node < 20 does not implement Array.prototype.toReversed/toSorted/etc.
// Metro's config loader uses `toReversed()` in recent versions.
if (!Array.prototype.toReversed) {
  Object.defineProperty(Array.prototype, 'toReversed', {
    value: function toReversed() {
      return Array.prototype.slice.call(this).reverse()
    },
    writable: true,
    configurable: true,
  })
}

const { getDefaultConfig } = require('expo/metro-config')
const fs = require('fs')
const path = require('path')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)
const previousEnhanceMiddleware = config.server && config.server.enhanceMiddleware

// ⚠️ НЕ трогаем resolver несколько раз
config.resolver = {
  ...config.resolver,
  resolverMainFields: ['react-native', 'main', 'browser'],
  assetExts: [...config.resolver.assetExts, 'ico'],
}

// ❌ react-native-maps — ТОЛЬКО native
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName.startsWith('react-native-svg/lib/module/')) {
    const mapped = moduleName.replace('react-native-svg/lib/module/', 'react-native-svg/lib/commonjs/')
    const candidate = path.resolve(__dirname, 'node_modules', mapped)
    const filePath = fs.existsSync(candidate)
      ? candidate
      : fs.existsSync(candidate + '.js')
        ? candidate + '.js'
        : candidate

    return {
      filePath,
      type: 'sourceFile',
    }
  }

  if (platform === 'web' && moduleName === 'react-native-svg') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/react-native-svg/lib/commonjs/index.js'),
      type: 'sourceFile',
    }
  }

  if (platform === 'web' && moduleName.startsWith('react-native-maps')) {
    return {
      filePath: path.resolve(__dirname, 'metro-stubs/react-native-maps.js'),
      type: 'sourceFile',
    }
  }

  return context.resolveRequest(context, moduleName, platform)
}

// ❌ CSS — игнорируем (Leaflet CSS подключаем вручную)
config.resolver.resolveRequest = ((orig) => {
  return (context, moduleName, platform) => {
    if (platform === 'web' && moduleName.endsWith('.css')) {
      return {
        filePath: path.resolve(__dirname, 'metro-stubs/empty.js'),
        type: 'sourceFile',
      }
    }
    return orig(context, moduleName, platform)
  }
})(config.resolver.resolveRequest)

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    const baseMiddleware =
      typeof previousEnhanceMiddleware === 'function'
        ? previousEnhanceMiddleware(middleware)
        : middleware

    const publicRoot = path.resolve(__dirname, 'public')
    const mimeByExt = {
      '.ico': 'image/x-icon',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.json': 'application/json; charset=utf-8',
      '.txt': 'text/plain; charset=utf-8',
    }

    return (req, res, next) => {
      try {
        const url = typeof req.url === 'string' ? req.url : ''
        const pathname = url.split('?')[0] || ''
        const shouldServe =
          pathname === '/manifest.json' ||
          pathname.startsWith('/assets/') ||
          pathname === '/favicon.ico' ||
          pathname.startsWith('/favicon-') ||
          pathname.startsWith('/apple-touch-icon')

        if (shouldServe) {
          const relative = pathname.replace(/^\/+/, '')
          const filePath = path.resolve(publicRoot, relative)
          const safeRoot = publicRoot.endsWith(path.sep) ? publicRoot : publicRoot + path.sep

          if (filePath.startsWith(safeRoot) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase()
            res.setHeader('Content-Type', mimeByExt[ext] || 'application/octet-stream')
            fs.createReadStream(filePath).pipe(res)
            return
          }
        }
      } catch {
        // noop
      }

      return baseMiddleware(req, res, next)
    }
  },
}

module.exports = config
