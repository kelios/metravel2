#!/usr/bin/env node
'use strict'

// Единственный чтец `/.build-source.json` прода (#3272). До него ревизию живого
// релиза читали двое — гейт источника перед выкатом
// (`scripts/assert-deployable-source.js`) и сверка после выката
// (`scripts/verify-live-release.sh`) — каждый своим разбором ответа: правка
// формата маркера или правила «что считать sha» расходилась бы между «до» и
// «после» одного выката.
//
//   node scripts/lib/live-build-source.js [origin]   → sha в stdout либо пусто
//
// Одна попытка без повторов: сколько раз и с какой паузой спрашивать, решает
// вызывающий. Код возврата CLI всегда 0 — «не прочитано» это пустая строка.

const { execFileSync } = require('node:child_process')

const ARTIFACT_MARKER_NAME = '.build-source.json'
const DEFAULT_LIVE_ORIGIN = 'https://metravel.by'
const SHA_PATTERN = /^[a-f0-9]{40}$/

function liveBuildSourceUrl(origin = DEFAULT_LIVE_ORIGIN) {
  return `${String(origin).replace(/\/+$/, '')}/${ARTIFACT_MARKER_NAME}`
}

function fetchLiveSha(origin) {
  const url = liveBuildSourceUrl(origin)
  try {
    const body = execFileSync('curl', ['-fsS', '--max-time', '10', url], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const sha = String(JSON.parse(body).sha || '')
    if (SHA_PATTERN.test(sha)) return { sha, url }
    return { sha: '', url, reason: 'в ответе нет поля sha с полным хешем коммита' }
  } catch (error) {
    const reason = String((error && error.stderr) || (error && error.message) || error).trim().split('\n').pop()
    return { sha: '', url, reason }
  }
}

if (require.main === module) {
  process.stdout.write(fetchLiveSha(process.argv[2] || process.env.VERIFY_LIVE_ORIGIN || DEFAULT_LIVE_ORIGIN).sha)
}

module.exports = { ARTIFACT_MARKER_NAME, DEFAULT_LIVE_ORIGIN, SHA_PATTERN, fetchLiveSha, liveBuildSourceUrl }
