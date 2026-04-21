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
const { pipeline } = require('stream')
const { URL } = require('url')

// metro-config doesn't export exclusionList in all versions; load it via absolute path.
const exclusionList = require(path.join(
  path.dirname(require.resolve('metro-config')),
  'defaults/exclusionList'
)).default

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)
const previousEnhanceMiddleware = config.server && config.server.enhanceMiddleware
const DEFAULT_DEV_API_HOST = 'http://192.168.50.36'

const isSameLocalOrigin = (targetUrl, requestHost) => {
  if (!targetUrl || !requestHost) return false

  try {
    const parsedTarget = new URL(targetUrl)
    const parsedRequest = new URL(
      `http://${String(requestHost).trim().replace(/^https?:\/\//i, '')}`
    )

    const targetPort = Number(parsedTarget.port || (parsedTarget.protocol === 'https:' ? '443' : '80'))
    const requestPort = Number(parsedRequest.port || '80')
    if (targetPort !== requestPort) return false

    const targetHost = parsedTarget.hostname
    const requestHostname = parsedRequest.hostname
    return (
      targetHost === requestHostname ||
      (targetHost === 'localhost' && requestHostname === '127.0.0.1') ||
      (targetHost === '127.0.0.1' && requestHostname === 'localhost')
    )
  } catch {
    return false
  }
}

// ✅ PERF: Don't watch or crawl large generated folders.
// This repo contains sizeable build/test artifacts (dist, reports, etc.) that can
// cause Metro's file crawling to balloon memory usage and crash with V8 OOM.
const escapeForRegex = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
const ignoredDirs = [
  'dist',
  'coverage',
  'output',
  'tmp',
  'test-results',
  'playwright-report',
  '.playwright-report-extracted',
  '.pwtrace_tmp',
  '.pwtrace_tmp_wizard',
  'lighthouse-reports',
  'e2e',
]
const ignoredRegexes = ignoredDirs.map((dir) => {
  const abs = path.resolve(__dirname, dir)
  // Keep the regex on the current platform separator only; Metro's exclusionList
  // rewrites path separators internally and breaks custom character classes on Windows.
  return new RegExp(`^${escapeForRegex(`${abs}${path.sep}`)}.*`)
})
config.resolver = config.resolver || {}
const existingBlockList = config.resolver.blockList
const additionalBlockList = exclusionList(ignoredRegexes)
config.resolver.blockList = existingBlockList instanceof RegExp
  ? new RegExp(`${existingBlockList.source}|${additionalBlockList.source}`)
  : additionalBlockList

// ✅ PERF: Enable inline requires — defers module execution until first use.
// This dramatically reduces TBT because heavy modules (reanimated, leaflet, PDF, quill, etc.)
// won't execute at startup even though they're in the same bundle.
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
}

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
// ✅ I2.2: Optional RNW tree-shake via slim barrel.
// Set EXPO_PUBLIC_RNW_SLIM=1 to enable cherry-picked react-native-web imports.
const RNW_SLIM_ENABLED = process.env.EXPO_PUBLIC_RNW_SLIM === '1'
config.resolver.resolveRequest = ((orig) => {
  return (context, moduleName, platform) => {
    // I2.2: RNW slim aliasing (opt-in)
    if (RNW_SLIM_ENABLED && platform === 'web' && moduleName === 'react-native') {
      return {
        filePath: path.resolve(__dirname, 'metro-stubs/react-native-web-slim.js'),
        type: 'sourceFile',
      }
    }
    if (platform === 'web' && moduleName === 'quill/dist/quill.snow.css') {
      return orig(context, moduleName, platform)
    }
    if (platform === 'web' && (moduleName === './global.css' || moduleName.endsWith('/global.css'))) {
      return orig(context, moduleName, platform)
    }
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

	    const isPrematureCloseError = (err) => {
	      const code = err && err.code
	      const message = String(err && err.message ? err.message : '')
	      return (
	        code === 'ERR_STREAM_PREMATURE_CLOSE' ||
	        code === 'ERR_STREAM_UNABLE_TO_PIPE' ||
	        code === 'ECONNRESET' ||
	        /premature close/i.test(message) ||
	        /closed or destroyed stream/i.test(message)
	      )
	    }

	    const publicRoot = path.resolve(__dirname, 'public')
      const projectAssetsRoot = path.resolve(__dirname, 'assets')
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
	        // Avoid noisy "Premature close" crashes/logs when the browser aborts requests
	        // (common during reloads, HMR, and when static rendering spins up/shuts down).
	        const swallowPrematureClose = (err) => {
	          if (err && isPrematureCloseError(err)) return
	          if (!err) return
	          console.error('[Metro middleware] Stream error:', err)
	        }

	        // Ensure no unhandled 'error' events surface from req/res streams.
	        req.on('error', swallowPrematureClose)
	        res.on('error', swallowPrematureClose)

	        let url = typeof req.url === 'string' ? req.url : ''
	        let pathname = url.split('?')[0] || ''
	        const search = url.includes('?') ? url.slice(url.indexOf('?')) : ''

        // Metro/Expo asset URLs may include a content hash in the filename, e.g.
        //   /assets/.../Feather.<hash>.ttf
        // but the dev server can expose the on-disk asset as:
        //   /assets/.../Feather.ttf
        // Rewrite the request to keep dev stable and avoid 404s for icon fonts.
        const hashedAssetMatch = pathname.match(
          /^\/assets\/(.+)\.([0-9a-f]{32})\.(ttf|otf|woff2?|eot)$/i
        )
        if (hashedAssetMatch) {
          const unhashedPath = `/assets/${hashedAssetMatch[1]}.${hashedAssetMatch[3]}`
          pathname = unhashedPath
          url = unhashedPath + search
          req.url = url
        }

        // Backward compatibility for legacy static URLs used outside Metro:
        // /icons/* should resolve to /assets/icons/* in local dev as well.
        if (pathname.startsWith('/icons/')) {
          pathname = `/assets${pathname}`
          url = pathname + search
          req.url = url
        }

	        // CORS proxy for API requests.
	        // Important: do not proxy Metro async chunks like /api/*.bundle,
	        // otherwise dynamic imports from "@/api/*" break with 404.
	        const isMetroModuleAsset = /\.bundle$|\.map$/i.test(pathname)
	        if (pathname.startsWith('/api/') && !isMetroModuleAsset) {
          const configuredApiHost = String(process.env.EXPO_PUBLIC_API_URL || '').trim()
          const apiHost = isSameLocalOrigin(configuredApiHost, req.headers.host)
            ? DEFAULT_DEV_API_HOST
            : configuredApiHost || DEFAULT_DEV_API_HOST
          if (configuredApiHost && apiHost !== configuredApiHost) {
            console.warn(
              `[Metro CORS Proxy] Ignoring self-proxy EXPO_PUBLIC_API_URL=${configuredApiHost}; using ${apiHost} instead.`
            )
          }
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
              if (res.writableEnded || res.destroyed) {
                if (!proxyReq.destroyed) proxyReq.destroy()
                if (!proxyRes.destroyed) proxyRes.destroy()
                return
              }

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

	              // If the client disconnects before the response is fully written,
                // stop upstream streams. Do not destroy completed responses.
	              res.on('close', () => {
                  if (res.writableEnded) return
                  if (!proxyReq.destroyed) proxyReq.destroy()
                  if (!proxyRes.destroyed) proxyRes.destroy()
	              })

	              proxyRes.on('aborted', () => {
	                proxyReq.destroy()
	              })

	              // Pipe response (handle premature close gracefully)
                if (res.writableEnded || res.destroyed) {
                  if (!proxyReq.destroyed) proxyReq.destroy()
                  if (!proxyRes.destroyed) proxyRes.destroy()
                  return
                }

	              pipeline(proxyRes, res, (err) => {
	                if (err && !isPrematureCloseError(err)) {
	                  console.error('[Metro CORS Proxy] Response pipeline error:', err)
	                }
	              })
	            }
		          );

		          proxyReq.on('error', (err) => {
		            if (isPrematureCloseError(err) || res.writableEnded || res.destroyed) return
		            console.error('[Metro CORS Proxy] Error:', err)
		            if (!res.headersSent) res.statusCode = 502
		            res.end('Bad Gateway')
		          })

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
	          pipeline(req, proxyReq, (err) => {
	            if (err && !isPrematureCloseError(err)) {
	              console.error('[Metro CORS Proxy] Request pipeline error:', err)
	            }
	          })
	          return;
	        }

        // Serve static files from public/
        const shouldServe =
          pathname === '/manifest.json' ||
          pathname === '/icon.svg' ||
          pathname === '/robots.txt' ||
          pathname.startsWith('/assets/') ||
          pathname === '/favicon.ico' ||
          pathname.startsWith('/favicon-') ||
          pathname.startsWith('/apple-touch-icon')

	        if (shouldServe) {
	          const relative = pathname.replace(/^\/+/, '')
	          const filePath = path.resolve(publicRoot, relative)
	          const safeRoot = publicRoot.endsWith(path.sep) ? publicRoot : publicRoot + path.sep
            const fallbackAssetRelative = relative.startsWith('assets/')
              ? relative.slice('assets/'.length)
              : relative
            const fallbackAssetPath = path.resolve(projectAssetsRoot, fallbackAssetRelative)
            const safeAssetsRoot = projectAssetsRoot.endsWith(path.sep)
              ? projectAssetsRoot
              : projectAssetsRoot + path.sep

            const chosenPath =
              filePath.startsWith(safeRoot) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()
                ? filePath
                : fallbackAssetPath.startsWith(safeAssetsRoot) &&
                    fs.existsSync(fallbackAssetPath) &&
                    fs.statSync(fallbackAssetPath).isFile()
                  ? fallbackAssetPath
                  : null

	          if (chosenPath) {
	            const ext = path.extname(chosenPath).toLowerCase()
	            res.setHeader('Content-Type', mimeByExt[ext] || 'application/octet-stream')
	            const stream = fs.createReadStream(chosenPath)
	            res.on('close', () => stream.destroy())
	            pipeline(stream, res, (err) => {
	              if (err && !isPrematureCloseError(err)) {
	                console.error('[Metro middleware] Static pipeline error:', err)
	              }
	            })
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
