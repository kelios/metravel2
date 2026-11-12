#!/usr/bin/env node
'use strict'

/**
 * Guard: скрипт, пишущий на прод, не пишет при запуске без флага режима (#3304).
 *
 * 11.11.2026 разовый `migrate-antalya-quest.js`, запущенный «для проверки» без
 * аргументов, отправил пять боевых `POST /api/quest-steps/`. #3211 перевёл на
 * «запись только с `--apply`» 57 скриптов одного шаблона, но семейство шире:
 * `create-*-guide.js`, `upload-quest-*.js`, `fix-*.js` читали `--dry-run` руками,
 * то есть умолчанием была боевая запись, а опечатка во флаге означала её же.
 *
 * Guard перечисляет пишущие скрипты по разбору исходника, БЕЗ исполнения
 * (у многих нет `require.main === module`, загрузка файла — уже запуск), и
 * требует, чтобы режим каждого выбирал один из трёх проверенных механизмов:
 *
 *   1) `shared-mode`  — `scripts/lib/one-off-write-mode.js`: без флага пробный
 *      прогон, запись только с `--apply`, неизвестный флаг — код 2. Ручного
 *      чтения `--dry-run`/`--apply` рядом быть не должно;
 *   2) `cli-contract` — операторский CLI под `guard-cli-contract.js`
 *      (SEO-OPS-001): строгий разбор, пустой запуск без цели или режима — отказ;
 *   3) `registered`   — закрытый список ниже: собственный явный флаг записи
 *      либо доказанно читающий запрос. Каждая запись несёт причину и шаблон,
 *      который обязан найтись в коде, — список не переживает правку скрипта.
 *
 * «Пишущий скрипт» — файл под `scripts/` (кроме `scripts/lib/`), в коде которого
 * есть мутирующий HTTP-метод или multipart-форма И адрес либо сессия API сайта.
 * Новый файл с таким признаком вне трёх классов — находка `unguarded_writer`.
 *
 * Проверка офлайновая и живёт в `check:fast`.
 *
 *   node scripts/guard-prod-write-mode.js           # счётчики по классам и находки
 *   node scripts/guard-prod-write-mode.js --list    # полный перечень пишущих скриптов
 *   node scripts/guard-prod-write-mode.js --json
 *
 * Exit code 1 при любой находке.
 */

const fs = require('node:fs')
const path = require('node:path')

const { maskSource } = require('./lib/maskSource')
const { isCoveredFile } = require('./guard-cli-contract')

const SCRIPTS_DIR = 'scripts'
const SCRIPT_FILE = /\.(?:js|cjs|mjs)$/
// `scripts/lib/` — библиотеки, а не точки входа: запись в них включает вызывающий
// скрипт, и режим выбирает он. Каталоги с точкой — состояние и бэкапы прогонов.
const isExcludedDir = (relativeDir) =>
  relativeDir === `${SCRIPTS_DIR}/lib` || relativeDir === `${SCRIPTS_DIR}/node_modules` || path.posix.basename(relativeDir).startsWith('.')

// Регистр метода не важен: `fetch` сам поднимает `method: 'post'` до POST, и
// строчная запись иначе проводила бы боевой писатель мимо guard.
const MUTATING_REQUEST = /['"`](?:POST|PATCH|PUT|DELETE)['"`]|\bnew\s+FormData\b/i
// `--api-url=` — признак наравне с адресом: скрипт с дев-стендом по умолчанию тем же флагом целится в прод.
const SITE_API = /metravel-tool-session|metravel-token|metravel\.by|METRAVEL_(?:API|TOKEN)|EXPO_PUBLIC_API_URL|--api-url=/

const SHARED_MODE_CALL = /require\(\s*['"]\.\/lib\/one-off-write-mode['"]\s*\)\s*\.resolveOneOffWriteMode\(\s*args\s*,/
const HAND_ROLLED_MODE = /\.(?:includes|indexOf)\(\s*['"`]--(?:dry-run|apply)['"`]\s*\)|[=!]==\s*['"`]--(?:dry-run|apply)['"`]|\bhas\(\s*['"`](?:--)?(?:dry-run|apply)['"`]\s*\)/

// Запись «читающий запрос» (`readOnlyHosts`) доказывается адресатом, а не словом в
// файле (#3314): шаблон `googleapis.com` находился бы и после того, как рядом
// появился POST на сайт. Адресат мутирующего метода — ближайший абсолютный адрес
// выше по коду; сессии сайта и multipart-формы в таком скрипте быть не может.
const MUTATING_METHOD = /['"`](?:POST|PATCH|PUT|DELETE)['"`]/gi
const ABSOLUTE_URL = /https?:\/\/([a-z0-9.-]+)/gi
const SITE_SESSION = /metravel-tool-session|metravel-token|METRAVEL_TOKEN/
const GOOGLE_API_HOST = /(?:^|\.)googleapis\.com$/

/** Почему скрипт перестал быть «только читающим»; `null` — каждый мутирующий метод уходит на разрешённый хост. */
function readOnlyViolation(code, hosts) {
  if (/\bnew\s+FormData\b/.test(code)) return 'в скрипте появилась multipart-форма'
  if (SITE_SESSION.test(code)) return 'в скрипте появилась сессия или токен API сайта'
  const urls = [...code.matchAll(ABSOLUTE_URL)].map((match) => ({ index: match.index, host: match[1].toLowerCase() }))
  for (const method of code.matchAll(MUTATING_METHOD)) {
    const host = urls.filter((url) => url.index < method.index).at(-1)?.host
    if (!host || !hosts.test(host)) return `метод ${method[0]} уходит на ${host || 'адрес, которого нет выше по коду'}, а не на ${hosts}`
  }
  return null
}

/**
 * Закрытый список скриптов со своим механизмом. `evidence` обязан найтись в коде
 * (комментарии не считаются): переписали скрипт — запись либо подтверждается
 * заново, либо краснеет как `stale_registration`. `readOnlyHosts` — для записи
 * «POST здесь читает чужой API»: guard сверяет адресата каждого мутирующего метода.
 */
const REGISTERED = {
  'scripts/recover-travel-from-ssg.js': {
    evidence: /const DRY = !APPLY\b/,
    reason: 'цель — позиционный аргумент, умолчание — отчёт; PUT только с --apply, после бэкапа',
  },
  'scripts/places-bulk-update.js': {
    evidence: /apply: Boolean\(apply\)/,
    reason: 'разбор cli-contract; без --apply бэкенд получает apply=false и ничего не пишет, с --apply обязателен digest отревьюенного плана',
  },
  'scripts/instagram-publish.js': {
    evidence: /if \(!LIVE\) \{/,
    reason: 'умолчание — dry-run с файлом плана; PUT статьи только с --live',
  },
  'scripts/instagram-post.js': {
    evidence: /if \(!args\.publishApproved\) \{/,
    reason: 'публикация — только с --publish-approved после «да» владельца; репетиция грузит слайды в неопубликованный служебный черновик',
  },
  'scripts/books/storage.cjs': {
    evidence: /throw new Error\('Usage: storage\.cjs verify\|upload/,
    reason: 'хранилище книг в S3, не API сайта: пустой запуск — отказ, upload не перезаписывает объекты (If-None-Match) и проходит проверку прав, prune удаляет только с --apply',
  },
  'scripts/analytics-health-check.js': {
    evidence: /analyticsdata\.googleapis\.com\/v1beta\/properties\/\$\{propertyId\}:runReport/,
    readOnlyHosts: GOOGLE_API_HOST,
    reason: 'POST — читающие запросы отчётов Google; на сайт ничего не пишется',
  },
  'scripts/fetch-gsc-stats.js': {
    evidence: /searchconsole\.googleapis\.com\/webmasters\/v3\/sites\//,
    readOnlyHosts: GOOGLE_API_HOST,
    reason: 'POST — читающий запрос Search Console; на сайт ничего не пишется',
  },
}

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

function collectScriptFiles(rootDir) {
  const found = []
  const walk = (absoluteDir, relativeDir) => {
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const relative = `${relativeDir}/${entry.name}`
      if (entry.isDirectory()) {
        if (!isExcludedDir(relative)) walk(path.join(absoluteDir, entry.name), relative)
        continue
      }
      if (entry.isFile() && SCRIPT_FILE.test(entry.name)) found.push(relative)
    }
  }
  const scriptsDir = path.join(rootDir, SCRIPTS_DIR)
  if (fs.existsSync(scriptsDir)) walk(scriptsDir, SCRIPTS_DIR)
  return found.sort()
}

/** Класс файла: `null` — не пишет на прод; иначе способ выбора режима либо находка. */
function classifySource({ filePath, content, registered = REGISTERED }) {
  const file = normalizePath(filePath)
  const code = maskSource(content)
  const writes = MUTATING_REQUEST.test(code) && SITE_API.test(code)
  const registration = registered[file]

  if (!writes) {
    return registration
      ? { file, kind: 'stale_registration', detail: 'файл в списке REGISTERED, но признаков записи на прод в нём больше нет — убрать запись' }
      : null
  }
  if (SHARED_MODE_CALL.test(code)) {
    if (HAND_ROLLED_MODE.test(code)) {
      return { file, kind: 'hand_rolled_mode', detail: 'режим берётся из one-off-write-mode, но рядом осталось ручное чтение --dry-run/--apply: опечатка во флаге снова выбирает режим молча' }
    }
    return { file, mode: 'shared-mode' }
  }
  if (isCoveredFile(file)) return { file, mode: 'cli-contract' }
  if (registration) {
    if (!registration.evidence.test(code)) {
      return { file, kind: 'stale_registration', detail: `шаблон ${registration.evidence} из REGISTERED в коде не найден — механизм записи переписан, подтвердить заново` }
    }
    const violation = registration.readOnlyHosts ? readOnlyViolation(code, registration.readOnlyHosts) : null
    if (violation) {
      return { file, kind: 'stale_registration', detail: `запись REGISTERED объявляет скрипт только читающим, но ${violation} — выбрать режим записи заново` }
    }
    return { file, mode: 'registered', reason: registration.reason }
  }
  return {
    file,
    kind: 'unguarded_writer',
    detail: 'скрипт пишет на прод, но режим не выбирает ни one-off-write-mode (запись только с --apply), ни cli-contract — пустой запуск или опечатка во флаге уйдут боевой записью',
  }
}

function scanScripts(rootDir, { registered = REGISTERED } = {}) {
  const files = collectScriptFiles(rootDir)
  const writers = []
  const findings = []
  const seen = new Set()

  for (const file of files) {
    seen.add(file)
    const verdict = classifySource({ filePath: file, content: fs.readFileSync(path.join(rootDir, file), 'utf8'), registered })
    if (!verdict) continue
    if (verdict.kind) findings.push(verdict)
    else writers.push(verdict)
  }
  for (const file of Object.keys(registered)) {
    if (!seen.has(file)) findings.push({ file, kind: 'stale_registration', detail: 'файл из списка REGISTERED не найден — убрать запись' })
  }
  // Чистый отчёт над пустым обходом — тот самый дефект, ради которого guard есть.
  if (!files.length) findings.push({ file: SCRIPTS_DIR, kind: 'empty_scan', detail: 'под scripts/ не найдено ни одного скрипта — запуск не из корня репозитория?' })

  return { scanned: files.length, writers, findings }
}

function reportText({ scanned, writers, findings }, { list = false } = {}) {
  const byMode = (mode) => writers.filter((writer) => writer.mode === mode)
  console.log(`Guard режима записи на прод: скриптов ${scanned}, пишущих с проверенным режимом ${writers.length}`)
  for (const mode of ['shared-mode', 'cli-contract', 'registered']) {
    const group = byMode(mode)
    console.log(`  ${mode}: ${group.length}`)
    // В `check:fast` — одна строка на класс; полный перечень — `--list` или `--json`.
    if (list) for (const writer of group) console.log(`    ${writer.file}${writer.reason ? ` — ${writer.reason}` : ''}`)
  }
  for (const finding of findings) {
    console.log(`\n  ${finding.kind}: ${finding.file}`)
    console.log(`    ${finding.detail}`)
  }
  console.log(findings.length ? `\nНарушений: ${findings.length}` : 'Нарушений нет.')
}

function main() {
  const result = scanScripts(process.cwd())
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2))
  else reportText(result, { list: process.argv.includes('--list') })
  if (result.findings.length) process.exitCode = 1
}

module.exports = { REGISTERED, classifySource, collectScriptFiles, scanScripts }

if (require.main === module) main()
