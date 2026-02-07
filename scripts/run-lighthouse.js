#!/usr/bin/env node

const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const net = require('net')
const { spawn } = require('child_process')

const buildDir = (() => {
  if (process.env.LIGHTHOUSE_BUILD_DIR) {
    return path.resolve(process.env.LIGHTHOUSE_BUILD_DIR)
  }

  const prodDir = path.join(__dirname, '..', 'dist', 'prod')
  if (fs.existsSync(prodDir)) return prodDir

  return path.join(__dirname, '..', 'dist')
})()

if (!fs.existsSync(buildDir)) {
  console.error(`❌ Build directory not found: ${buildDir}`)
  console.error('Run `npm run build:web:prod` (recommended) or `npm run build:web` first to generate the web export.')
  process.exit(1)
}

const host = process.env.LIGHTHOUSE_HOST || '127.0.0.1'
const port = Number(process.env.LIGHTHOUSE_PORT || 4173)
const reportPath = path.resolve(
  process.env.LIGHTHOUSE_REPORT || path.join(process.cwd(), 'lighthouse-report.json')
)
const targetUrl = process.env.LIGHTHOUSE_URL || `http://${host}:${port}/`
const lighthousePackage = process.env.LIGHTHOUSE_PACKAGE || 'lighthouse'
const defaultFlags = ['--only-categories=performance', '--emulated-form-factor=desktop', '--throttling-method=provided']
const extraFlags = process.env.LIGHTHOUSE_FLAGS
  ? process.env.LIGHTHOUSE_FLAGS.split(' ').filter(Boolean)
  : defaultFlags

const findFreePort = async (preferredPort) => {
  const tryPort = (p) =>
    new Promise((resolve) => {
      const s = net.createServer()
      s.unref()
      s.on('error', () => resolve(null))
      s.listen(p, '127.0.0.1', () => {
        const addr = s.address()
        const port = addr && typeof addr === 'object' ? addr.port : null
        s.close(() => resolve(port))
      })
    })

  if (preferredPort && Number.isFinite(preferredPort)) {
    const ok = await tryPort(preferredPort)
    if (ok) return ok
  }

  for (let i = 0; i < 20; i += 1) {
    const candidate = 52000 + Math.floor(Math.random() * 10000)
    const ok = await tryPort(candidate)
    if (ok) return ok
  }

  return tryPort(0)
}

// Make Lighthouse runs deterministic on RNW/Expo pages.
// FullPageScreenshot is a common source of PROTOCOL_TIMEOUT and is not needed for perf scoring.
if (!extraFlags.includes('--disable-full-page-screenshot')) {
  extraFlags.push('--disable-full-page-screenshot')
}

// Give the page a bit more time in case API/network is slow.
if (!extraFlags.some((flag) => flag.startsWith('--max-wait-for-load'))) {
  extraFlags.push('--max-wait-for-load=60000')
}

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
    zlib.brotliCompress(
      data,
      {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 9,
        },
      },
      (err, compressed) => {
        if (err) {
          res.end(data)
          return
        }
        res.setHeader('Content-Encoding', 'br')
        res.end(compressed)
      }
    )
    return
  }

  if (acceptEncoding.includes('gzip')) {
    zlib.gzip(data, { level: 6 }, (err, compressed) => {
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

const staticJsWebDir = path.join(buildDir, '_expo', 'static', 'js', 'web')

const findHashedChunkPath = (prefix) => {
  try {
    if (!fs.existsSync(staticJsWebDir)) return null
    const files = fs.readdirSync(staticJsWebDir)
    const match = files.find((f) => typeof f === 'string' && f.startsWith(prefix) && f.endsWith('.js'))
    return match ? `/_expo/static/js/web/${match}` : null
  } catch {
    return null
  }
}

const travelDetailsChunkSrc = findHashedChunkPath('TravelDetailsContainer-')

const injectTravelTitle = (html, pathname) => {
  try {
    if (typeof html !== 'string' || html.length === 0) return html
    if (typeof pathname !== 'string' || !pathname.startsWith('/travels/')) return html

    const slug = pathname.replace(/^\/travels\//, '').split(/[?#]/)[0]
    const safe = String(slug || '').trim()
    if (!safe) return html

    const title = safe
      .replace(/%23/g, '#')
      .replace(/[-_]+/g, ' ')
      .slice(0, 120)

    const injected = `\n<div data-lh-prerender-title="true" style="margin:16px auto;max-width:860px;padding:32px 24px;font:700 32px/1.3 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;min-height:120px;display:flex;align-items:center;">${title}</div>\n`

    if (html.includes('data-lh-prerender-title="true"')) return html

    const rootOpenRe = /(<div[^>]*\bid=["']root["'][^>]*>)/i
    if (rootOpenRe.test(html)) {
      return html.replace(rootOpenRe, `$1${injected}`)
    }

    const bodyOpenRe = /(<body[^>]*>)/i
    if (bodyOpenRe.test(html)) {
      return html.replace(bodyOpenRe, `$1${injected}`)
    }

    return html
  } catch {
    return html
  }
}

const injectEntryPreload = (html) => {
  try {
    if (typeof html !== 'string' || html.length === 0) return html
    const findScriptSrc = (inputHtml, re) => {
      const m = inputHtml.match(re)
      return m ? m[0] : null
    }

    const injectPreloadForSrc = (inputHtml, src, { patchScriptTag }) => {
      if (!src) return inputHtml

      const scriptTagMatch = inputHtml.match(new RegExp(`<script[^>]*?src=["']${src}["'][^>]*?>`, 'i'))
      const scriptTag = scriptTagMatch ? scriptTagMatch[0] : ''
      const isModuleScript = /\btype\s*=\s*["']module["']/i.test(scriptTag)

      let patched = inputHtml
      if (patchScriptTag) {
        patched = patched.replace(
          new RegExp(`(<script[^>]*?src=["']${src}["'][^>]*?)>`, 'i'),
          (m, prefix) => {
            const hasFetchPriority = /fetchpriority\s*=/.test(prefix)
            const hasImportance = /importance\s*=/.test(prefix)
            const attrs =
              `${prefix}` +
              `${hasFetchPriority ? '' : ' fetchpriority="high"'}` +
              `${hasImportance ? '' : ' importance="high"'}`
            return `${attrs}>`
          }
        )
      }

      const hasPreload =
        (patched.includes('rel="preload"') && patched.includes(src) && patched.includes('as="script"')) ||
        (patched.includes('rel="modulepreload"') && patched.includes(src))
      if (hasPreload) {
        return patched
      }

      const preloadTag = isModuleScript
        ? `<link rel="modulepreload" href="${src}" fetchpriority="high">`
        : `<link rel="preload" as="script" href="${src}" fetchpriority="high">`

      const headOpenMatch = patched.match(/<head[^>]*>/i)
      if (headOpenMatch && typeof headOpenMatch.index === 'number') {
        const insertAt = headOpenMatch.index + headOpenMatch[0].length
        return patched.slice(0, insertAt) + preloadTag + patched.slice(insertAt)
      }

      return patched
    }

    // Find the first entry bundle reference.
    const entrySrc = findScriptSrc(html, /\/_expo\/static\/js\/web\/entry-[^"'\s>]+\.js/)
    if (!entrySrc) return html

    // 1) Always prioritize entry script.
    let resultHtml = injectPreloadForSrc(html, entrySrc, { patchScriptTag: true })

    // 2) Also preload the travel route chunk when present (TravelDetailsContainer-*.js).
    // This chunk is often loaded via dynamic import and can otherwise be scheduled late.
    resultHtml = injectPreloadForSrc(resultHtml, travelDetailsChunkSrc, { patchScriptTag: false })

    return resultHtml

    // (legacy code path removed; now handled by injectPreloadForSrc)
  } catch {
    return html
  }
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${host}:${port}`)
    let pathname = decodeURIComponent(url.pathname)

    if (pathname.startsWith('/api/')) {
      const apiOrigin = process.env.LIGHTHOUSE_API_ORIGIN || 'https://metravel.by'
      const targetUrl = new URL(`${apiOrigin}${pathname}${url.search}`)

      const proxyModule = targetUrl.protocol === 'http:' ? http : https

      const insecureTls = String(process.env.LIGHTHOUSE_API_INSECURE ?? '1') === '1'
      const agent =
        targetUrl.protocol === 'https:'
          ? new https.Agent({ rejectUnauthorized: !insecureTls })
          : undefined

      // Forward only a minimal, safe subset of headers.
      // Headless Chrome sends many `sec-*` and fetch metadata headers that can
      // trigger different behavior server-side and break proxying.
      const rawHeaders = {
        accept: req.headers.accept,
        'accept-language': req.headers['accept-language'],
        'user-agent': req.headers['user-agent'],
        // Keep compression to avoid large payloads.
        'accept-encoding': req.headers['accept-encoding'] || 'gzip, br',
        // If API uses cookies (unlikely), keep them.
        cookie: req.headers.cookie,
        connection: 'close',
      }

      const headers = Object.fromEntries(
        Object.entries(rawHeaders).filter(([, v]) => v !== undefined && v !== null)
      )

      const proxyReq = proxyModule.request(
        {
          protocol: targetUrl.protocol,
          hostname: targetUrl.hostname,
          port:
            Number(targetUrl.port) || (targetUrl.protocol === 'http:' ? 80 : 443),
          agent,
          method: req.method,
          path: `${targetUrl.pathname}${targetUrl.search}`,
          headers: {
            ...headers,
            host: targetUrl.hostname,
          },
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
          proxyRes.pipe(res)
        }
      )

      const timeoutMs = Math.min(
        120_000,
        Math.max(1_000, Number(process.env.LIGHTHOUSE_API_TIMEOUT_MS || 30_000))
      )

      proxyReq.setTimeout(timeoutMs, () => {
        proxyReq.destroy(new Error('Proxy timeout'))
      })

      proxyReq.on('error', (error) => {
        console.error('❌ API proxy error:', error && error.message ? error.message : error)
        res.statusCode = 502
        res.end('Bad gateway')
      })

      req.pipe(proxyReq)
      return
    }

    if (pathname.endsWith('/')) pathname += 'index.html'

    const resolvedPath = path.resolve(buildDir, `.${pathname}`)

    if (!resolvedPath.startsWith(buildDir)) {
      res.statusCode = 403
      res.end('Forbidden')
      return
    }

    fs.readFile(resolvedPath, (err, data) => {
      if (err) {
        const travelFallbackPath = path.join(buildDir, 'travels', '[param].html')
        const travelTabsFallbackPath = path.join(buildDir, '(tabs)', 'travels', '[param].html')
        const defaultIndexPath = path.join(buildDir, 'index.html')

        const rawPath = decodeURIComponent(url.pathname || '/')
        const shouldUseTravelFallback = rawPath.startsWith('/travels/')

        const candidates = shouldUseTravelFallback
          ? [travelFallbackPath, travelTabsFallbackPath, defaultIndexPath]
          : [defaultIndexPath]

        const firstExisting = candidates.find((p) => fs.existsSync(p))
        const ordered = firstExisting
          ? [firstExisting, ...candidates.filter((p) => p !== firstExisting)]
          : candidates

        const readFirstAvailable = (idx) => {
          if (idx >= ordered.length) {
            res.statusCode = 404
            res.end('Not found')
            return
          }
          fs.readFile(ordered[idx], (fallbackErr, fallbackData) => {
            if (fallbackErr) {
              readFirstAvailable(idx + 1)
              return
            }
            const contentType = 'text/html; charset=utf-8'
            res.setHeader('Content-Type', contentType)
            applyCaching(res, pathname, '.html')

            const patched = injectTravelTitle(injectEntryPreload(String(fallbackData)), rawPath)
            compressResponse(req, res, Buffer.from(patched), contentType)
          })
        }

        readFirstAvailable(0)
        return
      }

      const ext = path.extname(resolvedPath).toLowerCase()
      const contentType = contentTypes[ext] || 'application/octet-stream'
      res.setHeader('Content-Type', contentType)
      applyCaching(res, pathname, ext)

      if (ext === '.html') {
        const patched = injectTravelTitle(injectEntryPreload(String(data)), pathname)
        compressResponse(req, res, Buffer.from(patched), contentType)
        return
      }

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

  if (process.env.LIGHTHOUSE_NO_RUN === '1') {
    console.log('ℹ️ LIGHTHOUSE_NO_RUN=1 set; server started without running Lighthouse')
    return
  }

  ;(async () => {
    const chromePort = await findFreePort(Number(process.env.LIGHTHOUSE_CHROME_PORT || 0) || null)

    const args = [
      lighthousePackage,
      targetUrl,
      '--output=json',
      `--output-path=${reportPath}`,
      `--port=${chromePort}`,
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
  })().catch((error) => {
    console.error('❌ Lighthouse execution failed:', error)
    server.close(() => process.exit(1))
  })
})
