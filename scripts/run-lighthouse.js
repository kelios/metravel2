#!/usr/bin/env node

const http = require('http')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const { spawn } = require('child_process')

const buildDir = process.env.LIGHTHOUSE_BUILD_DIR
  ? path.resolve(process.env.LIGHTHOUSE_BUILD_DIR)
  : path.join(__dirname, '..', 'dist')

if (!fs.existsSync(buildDir)) {
  console.error(`❌ Build directory not found: ${buildDir}`)
  console.error('Run `npm run build` first to generate the web export.')
  process.exit(1)
}

const host = process.env.LIGHTHOUSE_HOST || '127.0.0.1'
const port = Number(process.env.LIGHTHOUSE_PORT || 4173)
const reportPath = path.resolve(
  process.env.LIGHTHOUSE_REPORT || path.join(process.cwd(), 'lighthouse-report.json')
)
const targetUrl = process.env.LIGHTHOUSE_URL || `http://${host}:${port}/`
const lighthousePackage = process.env.LIGHTHOUSE_PACKAGE || 'lighthouse'
const extraFlags = process.env.LIGHTHOUSE_FLAGS
  ? process.env.LIGHTHOUSE_FLAGS.split(' ').filter(Boolean)
  : []

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

const compressibleTypes = new Set([
  'text/html',
  'application/javascript',
  'text/css',
  'application/json',
  'image/svg+xml',
])

const longCacheExtensions = new Set([
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.map',
])

const shouldCacheForever = (pathname, ext) => {
  if (pathname.startsWith('/_expo/static/') || pathname.startsWith('/assets/')) return true
  return longCacheExtensions.has(ext)
}

const applyCaching = (res, pathname, ext) => {
  if (ext === '.html' || pathname === '/' || pathname.endsWith('/index.html')) {
    res.setHeader('Cache-Control', 'no-cache')
    return
  }

  if (shouldCacheForever(pathname, ext)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return
  }

  res.setHeader('Cache-Control', 'no-cache')
}

const compressResponse = (req, res, data, contentType) => {
  const acceptEncoding = (req.headers['accept-encoding'] || '').toLowerCase()
  const baseType = String(contentType).split(';')[0].trim()
  const isCompressible = compressibleTypes.has(baseType)

  if (!isCompressible) {
    res.end(data)
    return
  }

  res.setHeader('Vary', 'Accept-Encoding')

  if (acceptEncoding.includes('br')) {
    zlib.brotliCompress(data, (err, compressed) => {
      if (err) {
        res.end(data)
        return
      }
      res.setHeader('Content-Encoding', 'br')
      res.end(compressed)
    })
    return
  }

  if (acceptEncoding.includes('gzip')) {
    zlib.gzip(data, (err, compressed) => {
      if (err) {
        res.end(data)
        return
      }
      res.setHeader('Content-Encoding', 'gzip')
      res.end(compressed)
    })
    return
  }

  res.end(data)
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${host}:${port}`)
    let pathname = decodeURIComponent(url.pathname)
    if (pathname.endsWith('/')) pathname += 'index.html'

    const resolvedPath = path.resolve(buildDir, `.${pathname}`)

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
          const contentType = 'text/html; charset=utf-8'
          res.setHeader('Content-Type', contentType)
          applyCaching(res, pathname, '.html')
          compressResponse(req, res, fallbackData, contentType)
        })
        return
      }

      const ext = path.extname(resolvedPath).toLowerCase()
      const contentType = contentTypes[ext] || 'application/octet-stream'
      res.setHeader('Content-Type', contentType)
      applyCaching(res, pathname, ext)
      compressResponse(req, res, data, contentType)
    })
  } catch {
    res.statusCode = 500
    res.end('Server error')
  }
})

server.on('error', (error) => {
  console.error('❌ Failed to start lighthouse server:', error)
  process.exit(1)
})

server.listen(port, host, () => {
  console.log(`✅ Lighthouse server running at ${targetUrl}`)

  const args = [
    lighthousePackage,
    targetUrl,
    '--output=json',
    `--output-path=${reportPath}`,
    ...extraFlags,
    '--chrome-flags=--headless --no-sandbox',
  ]

  const child = spawn('npx', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  const shutdown = (code) => {
    server.close(() => {
      if (typeof code === 'number') {
        process.exit(code)
      }
      process.exit(1)
    })
  }

  child.on('exit', shutdown)
  child.on('error', (error) => {
    console.error('❌ Lighthouse execution failed:', error)
    shutdown(1)
  })
})
