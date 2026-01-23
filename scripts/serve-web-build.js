#!/usr/bin/env node

const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const { URL } = require('url')

const buildDir = process.env.E2E_BUILD_DIR
  ? path.resolve(process.env.E2E_BUILD_DIR)
  : path.join(__dirname, '..', 'dist')

if (!fs.existsSync(buildDir)) {
  console.error(`❌ Build directory not found: ${buildDir}`)
  console.error('Run `npm run build:web` first to generate the web export.')
  process.exit(1)
}

const host = process.env.E2E_HOST || '127.0.0.1'
const port = Number(process.env.E2E_WEB_PORT || process.env.PORT || '8085')

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
}

const apiProxyTarget = process.env.E2E_API_PROXY_TARGET || 'https://metravel.by'
const allowInsecureProxy = String(process.env.E2E_API_PROXY_INSECURE || '').toLowerCase() === 'true'
const proxyPaths = ['/api/', '/api', '/travel-image/', '/address-image/', '/gallery/', '/uploads/', '/media/']

const proxyRequest = (req, res, target) => {
  try {
    const targetUrl = new URL(target)
    const isHttps = targetUrl.protocol === 'https:'
    const proxyModule = isHttps ? https : http
    const upstreamPath = req.url || '/'
    const upstreamUrl = new URL(upstreamPath, targetUrl)

    const proxyReq = proxyModule.request(
      {
        hostname: upstreamUrl.hostname,
        port: upstreamUrl.port || (isHttps ? 443 : 80),
        path: upstreamUrl.pathname + upstreamUrl.search,
        method: req.method,
        ...(isHttps ? { rejectUnauthorized: !allowInsecureProxy } : null),
        headers: {
          ...req.headers,
          host: upstreamUrl.host,
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
        proxyRes.pipe(res)
      }
    )

    proxyReq.on('error', (error) => {
      console.error('❌ API proxy error:', error && error.message ? error.message : error)
      res.statusCode = 502
      res.end('Proxy error')
    })

    req.pipe(proxyReq)
  } catch (error) {
    console.error('❌ API proxy error:', error && error.message ? error.message : error)
    res.statusCode = 500
    res.end('Proxy error')
  }
}

const server = http.createServer((req, res) => {
  try {
    const shouldProxy = proxyPaths.some((prefix) => req.url && req.url.startsWith(prefix))
    if (shouldProxy) {
      proxyRequest(req, res, apiProxyTarget)
      return
    }

    const url = new URL(req.url || '/', `http://${host}:${port}`)
    let pathname = decodeURIComponent(url.pathname)
    if (pathname.endsWith('/')) pathname += 'index.html'

    const resolvedPath = path.join(buildDir, pathname)

    if (!resolvedPath.startsWith(buildDir)) {
      res.statusCode = 403
      res.end('Forbidden')
      return
    }

    fs.readFile(resolvedPath, (err, data) => {
      if (err) {
        const indexPath = path.join(buildDir, 'index.html')
        fs.readFile(indexPath, (fallbackErr, fallbackData) => {
          if (fallbackErr) {
            res.statusCode = 404
            res.end('Not found')
            return
          }
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(fallbackData)
        })
        return
      }

      const ext = path.extname(resolvedPath).toLowerCase()
      const contentType = contentTypes[ext] || 'application/octet-stream'
      res.setHeader('Content-Type', contentType)
      res.end(data)
    })
  } catch {
    res.statusCode = 500
    res.end('Server error')
  }
})

server.on('error', (error) => {
  console.error('❌ Failed to start web server:', error)
  process.exit(1)
})

server.listen(port, host, () => {
  console.log(`✅ Web build server running at http://${host}:${port}`)
})

const shutdown = () => {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
