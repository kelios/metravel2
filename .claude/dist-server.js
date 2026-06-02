// Local-only static server for dist/ with clean-URL rewrites so the SPA router
// sees the real route path (/search instead of /search.html). Audit tooling only.
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = Number(process.argv[2] || 4601)
const ROOT = path.join(__dirname, '..', 'dist')

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

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain' })
  res.end(body)
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
  // Expo dynamic route fallback: /travels/<slug> -> travels/[param].html (or [id].html)
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
    send(res, 404, 'Not found')
  })
  .listen(PORT, () => console.log('dist-server on http://localhost:' + PORT + ' root=' + ROOT))
