#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { AsyncLocalStorage } = require('node:async_hooks')
const { assertServerExport, containedFile } = require('./lib/webServerArtifact')
const { resolveWebOutput } = require('./lib/webOutput')
const { installSsrApiTransport } = require('./lib/ssrApiTransport')
const { installRequestLocaleStore, resolveRequestLocale } = require('../utils/ssr/requestLocale')
const { SHARED_CSS_URL_DIR, SSR_CRITICAL_CSS_ENV, isSharedCriticalCssFile } = require('../utils/ssr/criticalCss')

const repoRoot = path.resolve(__dirname, '..')
const CONTENT_TYPES = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
}

function resolveClientFile(clientDir, pathname) {
  const decoded = decodeURIComponent(pathname)
  if (!decoded.startsWith('/') || decoded.includes('\\') || decoded.includes('\0') ||
    decoded.split('/').some((segment) => segment.startsWith('.'))) return null
  if (decoded.startsWith('/_expo/loaders/')) return null
  if (!CONTENT_TYPES[path.extname(decoded).toLowerCase()]) return null
  try {
    return containedFile(clientDir, decoded.slice(1))
  } catch {
    // An invalid/symlinked public file is never passed to the server renderer.
    return null
  }
}

function createSsrServer({ buildDir = process.env.SSR_BUILD_DIR || path.join(repoRoot, '.codex-temp/ssr-2766') } = {}) {
  // Pin the immutable generation before loading modules or serving files.
  // A deployment may move the current symlink while this process drains.
  const generationDir = fs.realpathSync(path.resolve(buildDir))
  const envPath = path.join(generationDir, '.ssr-env.json')
  if (fs.existsSync(envPath)) {
    // Public configuration belongs to the immutable client/server generation:
    // an external override cannot change the already compiled client bundle.
    // Local API fixtures use SSR_API_ORIGIN, which is never packaged here.
    const config = JSON.parse(fs.readFileSync(envPath, 'utf8'))
    for (const [key, value] of Object.entries(config)) {
      if (!/^EXPO_PUBLIC_[A-Z0-9_]+$/.test(key) || typeof value !== 'string') throw new Error('Invalid SSR public configuration')
      process.env[key] = value
    }
  }
  if (resolveWebOutput() !== 'server') throw new Error('SSR runner requires explicit server output and runtime flags')
  const { serverDir, clientDir } = assertServerExport(generationDir)
  const requestLocales = installRequestLocaleStore(new AsyncLocalStorage())
  installSsrApiTransport()
  const { createRequestHandler } = require('expo-server/adapter/http')
  const handleExpo = createRequestHandler({ build: serverDir, environment: 'production' }, {
    handleRouteError(error) {
      const requestedStatus = error.httpStatus ?? error.status
      const status = [404, 410, 503].includes(requestedStatus) ? requestedStatus : 500
      return new Response({ 404: 'Not found', 410: 'Gone', 503: 'Service unavailable', 500: 'Server error' }[status], {
        status,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store',
          ...(status === 503 ? { 'Retry-After': '30' } : {}),
        },
      })
    },
  })
  let sha = null
  let dirty = null
  let criticalCss = null
  const marker = path.join(generationDir, '.ssr-build.json')
  if (fs.existsSync(marker)) {
    const source = JSON.parse(fs.readFileSync(marker, 'utf8'))
    const value = source.sha
    if (typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)) sha = value
    if (typeof source.dirty === 'boolean') dirty = source.dirty
    criticalCss = source.criticalCss
  }
  // Ссылку вместо инлайна получает только файл, который реально лежит в
  // раздаче этого поколения; иначе +html оставляет инлайн (#2768).
  if (isSharedCriticalCssFile(criticalCss) && fs.existsSync(path.join(clientDir, ...SHARED_CSS_URL_DIR.split('/').filter(Boolean), criticalCss))) {
    process.env[SSR_CRITICAL_CSS_ENV] = criticalCss
  } else {
    delete process.env[SSR_CRITICAL_CSS_ENV]
  }
  return http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || '/', 'http://localhost').pathname
      if (pathname === '/_health' || pathname === '/health') {
        res.setHeader('Cache-Control', 'no-store')
        if (!['GET', 'HEAD'].includes(req.method)) {
          res.writeHead(405, { Allow: 'GET, HEAD' })
          res.end()
          return
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok', sha, dirty }))
        return
      }
      const clientFile = ['GET', 'HEAD'].includes(req.method) ? resolveClientFile(clientDir, pathname) : null
      if (clientFile) {
        res.setHeader('Content-Type', CONTENT_TYPES[path.extname(clientFile).toLowerCase()])
        res.setHeader('Content-Length', fs.statSync(clientFile).size)
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Cache-Control', pathname.startsWith('/_expo/static/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300')
        if (req.method === 'HEAD') res.end()
        else fs.createReadStream(clientFile).on('error', () => res.destroy()).pipe(res)
        return
      }
      if (pathname.startsWith('/_expo/static/') || pathname.startsWith('/assets/')) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
        res.end(req.method === 'HEAD' ? undefined : 'Not found')
        return
      }
      const expectedSha = req.headers['x-metravel-expected-sha']
      if (expectedSha !== undefined && expectedSha !== sha) {
        res.writeHead(503, { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' })
        res.end(req.method === 'HEAD' ? undefined : 'Service unavailable')
        return
      }
      if (sha) res.setHeader('X-Metravel-Ssr-Source', sha)
      await requestLocales.run(Object.freeze({ locale: resolveRequestLocale(req.url) }), () =>
        handleExpo(req, res, (error) => {
          res.statusCode = error ? 500 : 404
          res.setHeader('Cache-Control', 'no-store')
          res.end(error ? 'Server error' : 'Not found')
        }))
    } catch (error) {
      if (res.headersSent) res.destroy()
      else {
        res.statusCode = error instanceof URIError ? 400 : 500
        res.setHeader('Cache-Control', 'no-store')
        res.end(error instanceof URIError ? 'Bad request' : 'Server error')
      }
    }
  })
}

function main() {
  const options = { buildDir: process.env.SSR_BUILD_DIR || path.join(repoRoot, '.codex-temp/ssr-2766'), host: process.env.SSR_HOST || '127.0.0.1', port: Number(process.env.SSR_PORT || 8096) }
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i += 2) {
    const name = { '--build-dir': 'buildDir', '--host': 'host', '--port': 'port' }[args[i]]
    if (!name || !args[i + 1]) throw new Error('Usage: serve-web-ssr.js [--build-dir path] [--host host] [--port number]')
    options[name] = name === 'port' ? Number(args[i + 1]) : args[i + 1]
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) throw new Error('Invalid SSR port')
  const server = createSsrServer(options)
  server.listen(options.port, options.host, () => console.log(`[serve-web-ssr] http://${options.host}:${server.address().port}`))
  server.once('error', (error) => { console.error(`[serve-web-ssr] ${error.message}`); process.exitCode = 1 })
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(() => process.exit(0))
      setTimeout(() => process.exit(1), 10_000).unref()
    })
  }
}

module.exports = { createSsrServer, resolveClientFile, main }
if (require.main === module) main()
