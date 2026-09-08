#!/usr/bin/env node
'use strict'

// Shared source-gate for every prod ship path (#1883).
// build-prod.sh, scripts/build-web-prod.js and scripts/fix-prod.sh must call
// this before publishing an artifact. The checks themselves live here so a
// missing call in any one file is a test failure, not a second copy of git
// logic that can drift.

const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const repoRoot = path.resolve(__dirname, '..')
const ARTIFACT_MARKER_NAME = '.build-source.json'

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

function evaluate({ allowDirty, deploying, cwd = repoRoot }) {
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
  return { ok: true, sha, dirty: dirtyFlag, deploy: true, lines }
}

function checkMarker(markerPath, { allowDirty }) {
  const lines = []
  if (!fs.existsSync(markerPath)) {
    return {
      ok: false,
      lines: [
        `❌ Артефакт без маркера происхождения (${path.relative(repoRoot, markerPath) || markerPath}) — пересоберите, не заливайте build-only dist с грязного дерева`,
      ],
    }
  }
  const marker = readMarker(markerPath)
  lines.push(`🔖 Маркер артефакта: sha=${marker.sha} dirty=${Boolean(marker.dirty)} deploy=${Boolean(marker.deploy)}`)
  if (marker.dirty && !allowDirty) {
    lines.push('❌ Этот dist собран из грязного дерева. fix-prod.sh отказывается его заливать.')
    lines.push('   Пересоберите на чистом origin/main или аварийный обход: --allow-dirty')
    return { ok: false, marker, lines }
  }
  if (marker.deploy === false && !allowDirty) {
    lines.push('❌ Этот dist помечен как build-only (DEPLOY=0). На прод его заливать нельзя.')
    lines.push('   Аварийный обход: --allow-dirty')
    return { ok: false, marker, lines }
  }
  if (allowDirty && (marker.dirty || marker.deploy === false)) {
    lines.push('⚠️  ВНИМАНИЕ: --allow-dirty, заливается артефакт с dirty/build-only маркером')
  }
  return { ok: true, marker, lines }
}

function main() {
  const allowDirtyArg = arg('--allow-dirty', hasFlag('--allow-dirty') ? '1' : '0')
  const allowDirty = allowDirtyArg === '1' || allowDirtyArg === 'true'
  const deploying = arg('--deploy', '1')
  const cwd = arg('--cwd', repoRoot)
  const writeMarkerPath = arg('--write-marker', '')
  const checkMarkerPath = arg('--check-marker', '')
  const copyMarkerPath = arg('--copy-marker', '')
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

  if (checkMarkerPath) {
    const result = checkMarker(path.resolve(cwd, checkMarkerPath), { allowDirty })
    for (const line of result.lines) console.log(line)
    process.exit(result.ok ? 0 : 1)
  }

  const result = evaluate({ allowDirty, deploying, cwd })
  for (const line of result.lines) console.log(line)
  const payload = {
    sha: result.sha || '',
    dirty: Boolean(result.dirty),
    deploy: Boolean(result.deploy),
    ok: result.ok,
    recordedAt: new Date().toISOString(),
  }
  writeMarker(lastMarker, payload)
  if (writeMarkerPath) writeMarker(path.resolve(cwd, writeMarkerPath), payload)
  process.exit(result.ok ? 0 : 1)
}

if (require.main === module) main()

module.exports = {
  ARTIFACT_MARKER_NAME,
  defaultMarkerPath,
  evaluate,
  checkMarker,
  inspectSource,
  writeMarker,
  readMarker,
}
