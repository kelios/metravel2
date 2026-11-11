#!/usr/bin/env node
'use strict'

// Shared source-gate for every prod build path (#1883).
// build-prod.sh and scripts/build-web-prod.js must call this before producing
// an artifact. The checks themselves live here so a missing call in any one
// file is a test failure, not a second copy of git logic that can drift.
//
// #3207: the publisher (build-prod.sh with DEPLOY=1, and scripts/deploy-prod.sh
// before it creates the worktree) also asks for the live-revision check: a
// rollout must contain the revision production already serves. Reachability
// from origin/main alone let a session that waited on the deploy lock publish
// an ancestor of the live release, and both rollout reports stayed green.

const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { resolveBuildTimeMs } = require('./lib/buildStamp')
const { ARTIFACT_MARKER_NAME, DEFAULT_LIVE_ORIGIN, fetchLiveSha, liveBuildSourceUrl } = require('./lib/live-build-source')

const repoRoot = path.resolve(__dirname, '..')
// Distinct from a refusal (1): the requested revision is what production
// already serves, so there is nothing to build or publish.
const EXIT_ALREADY_LIVE = 3

function defaultMarkerPath(cwd = repoRoot) {
  return path.join(cwd, '.codex-temp', 'ops', 'last-build-source.json')
}

function arg(name, fallback = '') {
  const i = process.argv.indexOf(name)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function git(args, cwd = repoRoot) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
  }).trim()
}

function writeMarker(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function readMarker(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function inspectSource(cwd = repoRoot) {
  git(['rev-parse', '--is-inside-work-tree'], cwd)
  const sha = git(['rev-parse', 'HEAD'], cwd)
  let branch = ''
  try {
    branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
  } catch {
    branch = 'HEAD'
  }
  const dirty = git(['status', '--porcelain'], cwd)
  return { sha, branch, dirty }
}

function sleepSync(ms) {
  if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

// The same knobs as scripts/verify-live-release.sh: one origin and one retry
// budget describe "what production serves" before and after a rollout.
function readLiveSha({
  origin = process.env.VERIFY_LIVE_ORIGIN || DEFAULT_LIVE_ORIGIN,
  attempts = Math.max(1, positiveInt(process.env.VERIFY_LIVE_ATTEMPTS, 3)),
  delayMs = positiveInt(process.env.VERIFY_LIVE_RETRY_DELAY, 12) * 1000,
} = {}) {
  // Сам запрос и разбор ответа — общий чтец `scripts/lib/live-build-source.js`
  // (#3272); здесь только бюджет повторов.
  let reason = ''
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const observed = fetchLiveSha(origin)
    if (observed.sha) return { sha: observed.sha, url: observed.url, attempts: attempt }
    reason = observed.reason
    if (attempt < attempts) sleepSync(delayMs)
  }
  return { sha: '', url: liveBuildSourceUrl(origin), attempts, reason }
}

function hasCommit(sha, cwd) {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function isAncestor(ancestor, descendant, cwd) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd,
      stdio: 'ignore',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    return true
  } catch {
    return false
  }
}

// #3207: a rollout is monotonic. The target must contain the live revision —
// "is an ancestor of the live one" and "diverged from it" both take accepted
// commits off the site. `relation`:
//   ahead      live is an ancestor of the target — the ordinary rollout;
//   same       the target is what production serves — nothing to do;
//   behind     the target is an ancestor of the live revision;
//   diverged   neither contains the other (two sides of a merge);
//   unknown    the live revision is absent from the local history after a fetch;
//   unreadable production did not return a revision.
// Everything but `ahead` and `same` is refused unless the operator states the
// rollback explicitly with ALLOW_DOWNGRADE=1.
function checkLiveRevision({
  targetSha,
  cwd = repoRoot,
  allowDowngrade = process.env.ALLOW_DOWNGRADE === '1',
  live = undefined,
} = {}) {
  const lines = []
  const short = (sha) => String(sha).slice(0, 9)
  const refuse = (relation, liveSha, text, hint) => {
    if (allowDowngrade) {
      lines.push(`⚠️  ALLOW_DOWNGRADE=1: ${text} — выкат продолжается как явный откат`)
      return { ok: true, relation, downgrade: true, liveSha, lines }
    }
    lines.push(`❌ ${text}`)
    lines.push(`   ${hint}`)
    lines.push('   Осознанный откат или обход сверки: ALLOW_DOWNGRADE=1 (попадает в отчёт выката)')
    return { ok: false, relation, liveSha, lines }
  }

  const observed = live || readLiveSha()
  if (!observed.sha) {
    return refuse(
      'unreadable',
      '',
      `Живая ревизия прода не прочитана (${observed.url || ARTIFACT_MARKER_NAME}, попыток: ${observed.attempts || 1}${observed.reason ? `; ${observed.reason}` : ''})`,
      'Без неё не проверить, что выкат не старше живого релиза: повторите, когда прод ответит.',
    )
  }
  const liveSha = observed.sha
  if (liveSha === targetSha) {
    lines.push(`✅ Ревизия ${short(targetSha)} уже выкачена: прод отдаёт её в /${ARTIFACT_MARKER_NAME} — сборка и публикация не нужны`)
    return { ok: true, relation: 'same', liveSha, lines }
  }

  if (!hasCommit(liveSha, cwd)) {
    try {
      git(['fetch', '--quiet', 'origin', 'main'], cwd)
    } catch {
      lines.push('⚠️  Не удалось обновить origin/main — живая ревизия ищется в локальной истории')
    }
  }
  if (!hasCommit(liveSha, cwd)) {
    return refuse(
      'unknown',
      liveSha,
      `Живой ревизии прода ${short(liveSha)} нет в локальной истории даже после git fetch origin main`,
      'Родство с выкатываемой ревизией не установить: проверьте origin и повторите.',
    )
  }

  if (isAncestor(liveSha, targetSha, cwd)) {
    lines.push(`✅ Живая ревизия прода ${short(liveSha)} — предок выкатываемой ${short(targetSha)}`)
    return { ok: true, relation: 'ahead', liveSha, lines }
  }
  if (isAncestor(targetSha, liveSha, cwd)) {
    return refuse(
      'behind',
      liveSha,
      `Ревизия ${short(targetSha)} старше живой ${short(liveSha)}: прод уже содержит её, выкат откатил бы сайт назад`,
      'Скорее всего её уже выкатила другая сессия потомком — сверьте /.build-source.json и ничего не выкатывайте.',
    )
  }
  return refuse(
    'diverged',
    liveSha,
    `Ревизия ${short(targetSha)} не содержит живую ${short(liveSha)}: выкат снял бы с прода её коммиты`,
    'Выкатывайте ревизию, в которую живая уже влита (обычно origin/main).',
  )
}

function evaluate({ allowDirty, deploying, cwd = repoRoot, liveCheck = false, live = undefined }) {
  const lines = []
  let inside = true
  try {
    git(['rev-parse', '--is-inside-work-tree'], cwd)
  } catch {
    inside = false
  }
  if (!inside) {
    return {
      ok: false,
      lines: ['❌ Каталог не является Git-репозиторием: собираемый коммит не с чем сверить'],
    }
  }

  const { sha, branch, dirty } = inspectSource(cwd)
  const dirtyFlag = Boolean(dirty)
  lines.push(`🔖 Собираемый коммит: ${sha} (${branch})`)

  if (dirtyFlag) {
    const listing = dirty
      .split('\n')
      .filter(Boolean)
      .map((row) => `    ${row}`)
      .join('\n')
    if (String(deploying) !== '1') {
      lines.push(
        '⚠️  Дерево грязное, но это build-only (DEPLOY=' +
          deploying +
          ') — в артефакт попадёт незакоммиченная работа, деплоить его нельзя:',
      )
      lines.push(listing)
    } else if (allowDirty) {
      lines.push(
        '⚠️  ВНИМАНИЕ: --allow-dirty, собирается ГРЯЗНОЕ дерево — в артефакт попадёт незакоммиченная работа:',
      )
      lines.push(listing)
    } else {
      lines.push(
        '❌ Рабочее дерево грязное — сборка остановлена, чтобы чужая незакоммиченная работа не уехала на прод:',
      )
      lines.push(listing)
      lines.push('   Штатный путь — деплой из изолированного worktree на origin/main:')
      lines.push('     docs/WORKFLOW_OPERATIONS.md → «3.5 Деплой из изолированного worktree»')
      lines.push('   Осознанный обход: --allow-dirty')
      return {
        ok: false,
        sha,
        dirty: true,
        deploy: String(deploying) === '1',
        lines,
      }
    }
  }

  if (String(deploying) !== '1') {
    lines.push('ℹ️  DEPLOY=' + deploying + ': сборка без деплоя, сверка с origin/main пропущена')
    return {
      ok: true,
      sha,
      dirty: dirtyFlag,
      deploy: false,
      lines,
    }
  }

  const upstream = 'origin/main'
  try {
    git(['fetch', '--quiet', 'origin', 'main'], cwd)
  } catch {
    lines.push(`⚠️  Не удалось обновить ${upstream} — достижимость сверяется по локальной копии ссылки`)
  }

  try {
    git(['rev-parse', '--verify', '--quiet', upstream], cwd)
  } catch {
    lines.push(`❌ Ссылка ${upstream} недоступна: достижимость собираемого коммита не проверить`)
    return { ok: false, sha, dirty: dirtyFlag, deploy: true, lines }
  }

  try {
    execFileSync('git', ['merge-base', '--is-ancestor', 'HEAD', upstream], {
      cwd,
      stdio: 'ignore',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
  } catch {
    lines.push(
      `❌ Коммит ${sha} не достижим из ${upstream} — на прод уехало бы то, чего нет в main.`,
    )
    lines.push('   Запушьте работу и повторите: PREFLIGHT_SKIP_E2E=1 git push origin main')
    return { ok: false, sha, dirty: dirtyFlag, deploy: true, lines }
  }

  lines.push(`✅ Источник сборки: ${sha} достижим из ${upstream}`)
  if (!liveCheck) return { ok: true, sha, dirty: dirtyFlag, deploy: true, lines }

  const liveResult = checkLiveRevision({ targetSha: sha, cwd, live })
  if (liveResult.relation === 'same' && dirtyFlag) {
    // --allow-dirty on the live commit ships the uncommitted work on top of it:
    // the artifact differs from the live one although the sha does not.
    lines.push(`⚠️  Прод уже отдаёт ${sha.slice(0, 9)}, но дерево грязное (--allow-dirty) — собирается поверх живой ревизии`)
    return { ok: true, sha, dirty: dirtyFlag, deploy: true, lines }
  }
  lines.push(...liveResult.lines)
  return {
    ok: liveResult.ok,
    sha,
    dirty: dirtyFlag,
    deploy: true,
    alreadyLive: liveResult.relation === 'same',
    lines,
  }
}

function main() {
  const allowDirtyArg = arg('--allow-dirty', hasFlag('--allow-dirty') ? '1' : '0')
  const allowDirty = allowDirtyArg === '1' || allowDirtyArg === 'true'
  const deploying = arg('--deploy', '1')
  const cwd = arg('--cwd', repoRoot)
  const writeMarkerPath = arg('--write-marker', '')
  const copyMarkerPath = arg('--copy-marker', '')
  const liveCheck = arg('--live-check', '0') === '1' && String(deploying) === '1'
  const liveCheckOnly = arg('--live-check-only', '')
  const lastMarker = defaultMarkerPath(cwd)

  if (copyMarkerPath) {
    if (!fs.existsSync(lastMarker)) {
      console.log('❌ Нет маркера источника: сначала прогоните гейт сборки')
      process.exit(1)
    }
    const dest = path.resolve(cwd, copyMarkerPath)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(lastMarker, dest)
    console.log(`🔖 Маркер источника записан в ${path.relative(cwd, dest) || dest}`)
    process.exit(0)
  }

  // scripts/deploy-prod.sh asks before it creates the worktree: only the
  // relation of the named commit to the live release, no tree checks.
  if (liveCheckOnly) {
    let targetSha = ''
    try {
      targetSha = git(['rev-parse', '--verify', '--quiet', `${liveCheckOnly}^{commit}`], cwd)
    } catch {
      console.log(`❌ Ревизия ${liveCheckOnly} не найдена: сверять с живой нечего`)
      process.exit(1)
    }
    const result = checkLiveRevision({ targetSha, cwd })
    for (const line of result.lines) console.log(line)
    if (!result.ok) process.exit(1)
    process.exit(result.relation === 'same' ? EXIT_ALREADY_LIVE : 0)
  }

  const result = evaluate({ allowDirty, deploying, cwd, liveCheck })
  for (const line of result.lines) console.log(line)
  const payload = {
    sha: result.sha || '',
    dirty: Boolean(result.dirty),
    deploy: Boolean(result.deploy),
    ok: result.ok,
    // #2930: чистый источник — время коммита (детерминированный digest релиза),
    // грязный — момент сборки: его содержимое коммитом не описывается.
    recordedAt: new Date(
      result.sha && !result.dirty ? resolveBuildTimeMs({ rev: result.sha, cwd }) : Date.now(),
    ).toISOString(),
  }
  writeMarker(lastMarker, payload)
  if (writeMarkerPath) writeMarker(path.resolve(cwd, writeMarkerPath), payload)
  if (!result.ok) process.exit(1)
  process.exit(result.alreadyLive ? EXIT_ALREADY_LIVE : 0)
}

if (require.main === module) main()

module.exports = {
  ARTIFACT_MARKER_NAME,
  defaultMarkerPath,
  EXIT_ALREADY_LIVE,
  evaluate,
  checkLiveRevision,
  readLiveSha,
  inspectSource,
  writeMarker,
  readMarker,
}
