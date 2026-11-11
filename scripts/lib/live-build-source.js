#!/usr/bin/env node
'use strict'

// Единственный чтец `/.build-source.json` прода (#3272). До него ревизию живого
// релиза читали двое — гейт источника перед выкатом
// (`scripts/assert-deployable-source.js`) и сверка после выката
// (`scripts/verify-live-release.sh`) — каждый своим разбором ответа: правка
// формата маркера или правила «что считать sha» расходилась бы между «до» и
// «после» одного выката.
//
//   node scripts/lib/live-build-source.js [origin]           → sha в stdout либо пусто
//   node scripts/lib/live-build-source.js --state [origin]   → sha, `no-sha` либо пусто
//
// Одна попытка без повторов: сколько раз и с какой паузой спрашивать, решает
// вызывающий. Код возврата CLI всегда 0 — «не прочитано» это пустая строка.
// `--state` различает два «не прочитано» (#3305): хост ответил, но в маркере нет
// полного sha (`no-sha` — на проде не тот релиз либо не маркер вовсе), и хост не
// ответил (пусто — недоступность, о релизе ничего не известно).

const { execFileSync } = require('node:child_process')

const ARTIFACT_MARKER_NAME = '.build-source.json'
const DEFAULT_LIVE_ORIGIN = 'https://metravel.by'
const SHA_PATTERN = /^[a-f0-9]{40}$/

function liveBuildSourceUrl(origin = DEFAULT_LIVE_ORIGIN) {
  return `${String(origin).replace(/\/+$/, '')}/${ARTIFACT_MARKER_NAME}`
}

function fetchLiveSha(origin) {
  const url = liveBuildSourceUrl(origin)
  let body
  try {
    body = execFileSync('curl', ['-fsS', '--max-time', '10', url], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const reason = String((error && error.stderr) || (error && error.message) || error).trim().split('\n').pop()
    return { sha: '', url, answered: false, reason }
  }
  try {
    const sha = String(JSON.parse(body).sha || '')
    if (SHA_PATTERN.test(sha)) return { sha, url, answered: true }
  } catch {
    // Не JSON (например, HTML-оболочка вместо маркера) — тот же ответ без sha.
  }
  return { sha: '', url, answered: true, reason: 'в ответе нет поля sha с полным хешем коммита' }
}

if (require.main === module) {
  const args = process.argv.slice(2)
  const withState = args[0] === '--state'
  const observed = fetchLiveSha((withState ? args[1] : args[0]) || process.env.VERIFY_LIVE_ORIGIN || DEFAULT_LIVE_ORIGIN)
  process.stdout.write(observed.sha || (withState && observed.answered ? 'no-sha' : ''))
}

module.exports = { ARTIFACT_MARKER_NAME, DEFAULT_LIVE_ORIGIN, SHA_PATTERN, fetchLiveSha, liveBuildSourceUrl }
