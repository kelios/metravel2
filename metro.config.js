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

        // CORS proxy for API requests
        if (pathname.startsWith('/api/')) {
          const apiHost = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.50.36';
          const targetUrl = `${apiHost}${url}`;

          // Use node's http/https module for proxying
          const http = require('http');
          const https = require('https');
          const urlModule = require('url');
          const parsedUrl = urlModule.parse(targetUrl);
          const protocol = parsedUrl.protocol === 'https:' ? https : http;

          const proxyReq = protocol.request(
            {
              hostname: parsedUrl.hostname,
              port: parsedUrl.port,
              path: parsedUrl.path,
              method: req.method,
              headers: {
                ...req.headers,
                host: parsedUrl.hostname,
              },
            },
            (proxyRes) => {
              // Add CORS headers
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

              // Copy status and headers from proxy response
              res.statusCode = proxyRes.statusCode || 200;
              Object.keys(proxyRes.headers).forEach((key) => {
                const value = proxyRes.headers[key];
                if (value && key.toLowerCase() !== 'transfer-encoding') {
                  res.setHeader(key, value);
                }
              });

              // Pipe response
              proxyRes.pipe(res);
            }
          );

          proxyReq.on('error', (err) => {
            console.error('[Metro CORS Proxy] Error:', err.message);
            res.statusCode = 502;
            res.end('Bad Gateway');
          });

          // Handle OPTIONS preflight
          if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.statusCode = 204;
            res.end();
            return;
          }

          // Pipe request body
          req.pipe(proxyReq);
          return;
        }

        // Serve static files from public/
        const shouldServe =
          pathname === '/manifest.json' ||
          pathname === '/icon.svg' ||
          pathname === '/robots.txt' ||
          pathname === '/sw.js' ||
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
      } catch (err) {
        console.error('[Metro middleware] Error:', err);
      }

      return baseMiddleware(req, res, next)
    }
  },
}

module.exports = config
