// Local-only static server for dist/prod with clean-URL rewrites + Expo dynamic
// route fallback, mirroring production hosting. QA/repro tooling only.
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

const PORT = Number(process.argv[2] || 8081)
const ROOT = path.join(__dirname, '..', 'dist', 'prod')
const API_UPSTREAM = 'https://metravel.by'

function proxyApi(req, res) {
  const target = new URL(req.url, API_UPSTREAM)
  const headers = { ...req.headers, host: target.host }
  const upstream = https.request(
    target,
    { method: req.method, headers },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers)
      up.pipe(res)
    },
  )
  upstream.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('Bad gateway')
  })
  req.pipe(upstream)
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
}

function tryFiles(p) {
  const candidates = []
  if (p === '/' || p === '') candidates.push('index.html')
  const clean = p.replace(/^\/+/, '').replace(/\/+$/, '')
  if (clean) {
    candidates.push(clean)
    candidates.push(clean + '.html')
    candidates.push(path.join(clean, 'index.html'))
  }
  for (const c of candidates) {
    const abs = path.join(ROOT, c)
    if (abs.startsWith(ROOT) && fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs
  }
  if (clean) {
    const dir = path.dirname(clean)
    const dirAbs = path.join(ROOT, dir)
    if (dirAbs.startsWith(ROOT) && fs.existsSync(dirAbs) && fs.statSync(dirAbs).isDirectory()) {
      const dyn = fs.readdirSync(dirAbs).find((f) => /^\[.+\]\.html$/.test(f))
      if (dyn) return path.join(dirAbs, dyn)
    }
  }
  return null
}

http
  .createServer((req, res) => {
    if ((req.url || '').startsWith('/api/')) {
      proxyApi(req, res)
      return
    }
    const url = decodeURIComponent((req.url || '/').split('?')[0])
    const file = tryFiles(url)
    if (file) {
      const ext = path.extname(file).toLowerCase()
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
      fs.createReadStream(file).pipe(res)
      return
    }
    const notFound = path.join(ROOT, '+not-found.html')
    if (fs.existsSync(notFound)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      fs.createReadStream(notFound).pipe(res)
      return
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  })
  .listen(PORT, () => console.log('prod-server on http://localhost:' + PORT + ' root=' + ROOT))
