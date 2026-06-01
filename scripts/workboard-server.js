#!/usr/bin/env node
/**
 * Local-only workboard server for docs/AGENT_WORKBOARD_LOCAL.html.
 *
 * Serves the repo statically (so the board + markdown load over http) and
 * exposes two tiny write endpoints that append/patch task rows in
 * docs/AGENT_WORKBOARD.md. Not part of the Expo build — dev convenience only.
 *
 *   node scripts/workboard-server.js [port]   # default 4599
 */
'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')
const url = require('url')

const ROOT = path.resolve(__dirname, '..')
const MD_PATH = path.join(ROOT, 'docs', 'AGENT_WORKBOARD.md')
const PORT = parseInt(process.argv[2], 10) || 4599

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
}

// Section -> ID prefix used when auto-generating ids.
const PREFIX = {
  'Open tasks': 'T',
  'Full-page UI/UX QA wave': 'T',
  'Tech debt backlog': 'TD',
  'Performance Refactor backlog': 'PERF',
}

// ---- markdown table helpers ------------------------------------------------

const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())

const findCol = (header, re) => header.findIndex((h) => re.test(h))

const isSeparator = (line) => /^\|[\s:|-]+\|?\s*$/.test(line) && line.indexOf('-') !== -1

// Sanitize a value for a markdown table cell (no pipes / newlines).
const cell = (v) =>
  String(v == null ? '' : v)
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '/')
    .trim()

function colMapOf(header) {
  return {
    id: findCol(header, /^id$/i),
    title: findCol(header, /task|item|тема|страница/i),
    owner: findCol(header, /owner/i),
    prio: findCol(header, /priorit/i),
    status: findCol(header, /^status$/i),
    evidence: findCol(header, /evidence|цель/i),
    notes: findCol(header, /notes|заметк|кандидат/i),
  }
}

/**
 * Walk every `| ID | … | Status | … |` table.
 * onTable(meta) where meta = { section, headerLine, sepLine, dataStart, dataEnd, header, map }
 * onRow(rowMeta) where rowMeta = { lineIndex, cells, header, map, section }
 */
function walkTables(lines, { onTable, onRow } = {}) {
  let section = ''
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^##\s+(.*)$/)
    if (h) {
      section = h[1].trim()
      continue
    }
    if (lines[i].indexOf('|') !== 0) continue
    if (!isSeparator(lines[i + 1] || '')) continue

    const header = splitRow(lines[i])
    const map = colMapOf(header)
    if (map.id < 0 || map.status < 0) continue

    const dataStart = i + 2
    let j = dataStart
    for (; j < lines.length; j++) {
      if (lines[j].indexOf('|') !== 0) break
      if (onRow) {
        onRow({ lineIndex: j, cells: splitRow(lines[j]), header, map, section })
      }
    }
    if (onTable) {
      onTable({
        section,
        headerLine: i,
        sepLine: i + 1,
        dataStart,
        dataEnd: j, // first line after the table body
        header,
        map,
      })
    }
    i = j - 1
  }
}

function nextId(lines, prefix) {
  let max = 0
  const re = new RegExp('^' + prefix + '-(\\d+)$')
  walkTables(lines, {
    onRow: ({ cells, map }) => {
      const m = (cells[map.id] || '').match(re)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    },
  })
  return prefix + '-' + String(max + 1).padStart(3, '0')
}

function buildRow(header, map, fields) {
  const cells = header.map(() => '')
  if (map.id >= 0) cells[map.id] = cell(fields.id)
  if (map.title >= 0) cells[map.title] = cell(fields.title)
  if (map.owner >= 0) cells[map.owner] = cell(fields.owner) || '—'
  if (map.prio >= 0) cells[map.prio] = cell(fields.priority) || '—'
  if (map.status >= 0) cells[map.status] = cell(fields.status) || 'Open'
  if (map.evidence >= 0) cells[map.evidence] = cell(fields.evidence) || 'Evidence pending'
  if (map.notes >= 0) cells[map.notes] = cell(fields.notes) || '—'
  // any still-empty column gets a placeholder so the table stays well-formed
  for (let k = 0; k < cells.length; k++) if (!cells[k]) cells[k] = '—'
  return '| ' + cells.join(' | ') + ' |'
}

// ---- mutations -------------------------------------------------------------

function addTask(body) {
  const section = String(body.section || 'Open tasks')
  const prefix = PREFIX[section] || 'T'
  const md = fs.readFileSync(MD_PATH, 'utf8')
  const lines = md.split('\n')

  let target = null
  walkTables(lines, {
    onTable: (t) => {
      if (t.section === section && !target) target = t
    },
  })
  if (!target) {
    throw new Error('Раздел не найден или это не таблица задач: ' + section)
  }

  const id = (body.id && String(body.id).trim()) || nextId(lines, prefix)
  const row = buildRow(target.header, target.map, {
    id,
    title: body.title,
    owner: body.owner,
    priority: body.priority,
    status: body.status || 'Open',
    evidence: body.evidence,
    notes: body.notes,
  })

  lines.splice(target.dataEnd, 0, row)
  fs.writeFileSync(MD_PATH, lines.join('\n'))
  return { ok: true, id, section, status: body.status || 'Open' }
}

function updateTask(body) {
  const id = String(body.id || '').trim()
  if (!id) throw new Error('id обязателен')
  const md = fs.readFileSync(MD_PATH, 'utf8')
  const lines = md.split('\n')

  let hit = null
  walkTables(lines, {
    onRow: (r) => {
      if (!hit && (r.cells[r.map.id] || '').trim() === id) hit = r
    },
  })
  if (!hit) throw new Error('Задача не найдена: ' + id)

  const cells = hit.cells.slice()
  if (body.status != null && hit.map.status >= 0) cells[hit.map.status] = cell(body.status)
  if (body.owner != null && hit.map.owner >= 0) cells[hit.map.owner] = cell(body.owner) || '—'
  lines[hit.lineIndex] = '| ' + cells.join(' | ') + ' |'

  fs.writeFileSync(MD_PATH, lines.join('\n'))
  return { ok: true, id }
}

// ---- http ------------------------------------------------------------------

function sendJson(res, code, obj) {
  const data = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(data)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 1e6) reject(new Error('payload too large'))
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, '')
  if (rel === '') rel = 'docs/AGENT_WORKBOARD_LOCAL.html'
  const full = path.join(ROOT, rel)
  if (!full.startsWith(ROOT)) {
    sendJson(res, 403, { error: 'forbidden' })
    return
  }
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    fs.createReadStream(full).pipe(res)
  })
}

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url)

  if (req.method === 'POST' && pathname.startsWith('/api/workboard/')) {
    try {
      const body = await readBody(req)
      const action = pathname.replace('/api/workboard/', '')
      if (action === 'add') return sendJson(res, 200, addTask(body))
      if (action === 'update') return sendJson(res, 200, updateTask(body))
      return sendJson(res, 404, { error: 'unknown action' })
    } catch (e) {
      return sendJson(res, 400, { error: String(e.message || e) })
    }
  }

  if (req.method === 'GET') return serveStatic(req, res, pathname)
  sendJson(res, 405, { error: 'method not allowed' })
})

server.listen(PORT, () => {
  console.log(
    'Workboard server: http://localhost:' + PORT + '/docs/AGENT_WORKBOARD_LOCAL.html'
  )
})
