#!/usr/bin/env node

// #1999: Meta Business Verification сверяет зарегистрированное имя владельца
// (constants/legal.json) с текстом сайта, причём робот читает HTML без
// JavaScript. Главная получает имя через SSG-скелет (scripts/ssg-skeletons.js),
// /contact и /about — через предрендер AboutIntroCard. Guard падает, если хоть
// одна из этих страниц в собранном dist имени не содержит: иначе повторная
// проверка Meta снова закончится «Требуется дополнительная информация».

const fs = require('fs')
const path = require('path')

const LEGAL = require('../constants/legal.json')

// Страницы из Task Contract #1999. about.html проверяется, когда экспорт его
// создал: маршрут живёт в группе (tabs) и в редких конфигурациях экспорта
// может отсутствовать — отсутствие файла не должно ронять сборку.
const REQUIRED_ROUTE_FILES = Object.freeze(['index.html', 'contact.html'])
const OPTIONAL_ROUTE_FILES = Object.freeze(['about.html'])

function resolveRouteFile(distDir, file) {
  const direct = path.join(distDir, file)
  if (fs.existsSync(direct)) return direct
  const nested = path.join(distDir, file.replace(/\.html$/, ''), 'index.html')
  if (file !== 'index.html' && fs.existsSync(nested)) return nested
  return null
}

const HOME_LEGAL_MARKER = 'ssg-home-legal'

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Главная: имя обязано стоять в видимом тексте оболочки
// `<footer class="ssg-home-legal">…</footer>` (scripts/ssg-skeletons.js). Простой
// includes по файлу засчитал бы имя из JSON-LD или og-меты при потерянном футере.
function checkHomeHtml(html, name) {
  const footer = new RegExp(`<footer class="${HOME_LEGAL_MARKER}"[^>]*>([^<]*)</footer>`)
  const match = html.match(footer)
  if (!match) return `нет оболочки <footer class="${HOME_LEGAL_MARKER}"> с именем владельца`
  if (!new RegExp(escapeRegExp(name)).test(match[1])) {
    return `в <footer class="${HOME_LEGAL_MARKER}"> нет имени владельца «${name}»`
  }
  return null
}

// Предрендеренные маршруты (/contact, /about): имя приходит из React-дерева
// AboutIntroCard, у него нет стабильного маркера в HTML — достаточно текста.
function checkRouteHtml(html, name) {
  return html.includes(name) ? null : `нет имени владельца «${name}»`
}

function checkDist(distDir) {
  const name = LEGAL.siteOwnerLegalName
  const failures = []
  const checked = []
  const skipped = []
  const visit = (file, required) => {
    const resolved = resolveRouteFile(distDir, file)
    if (!resolved) {
      if (required) failures.push(`${file}: файл не найден в ${distDir}`)
      else skipped.push(file)
      return
    }
    const html = fs.readFileSync(resolved, 'utf8')
    const verdict = file === 'index.html' ? checkHomeHtml(html, name) : checkRouteHtml(html, name)
    if (verdict) {
      failures.push(`${path.relative(distDir, resolved)}: ${verdict}`)
      return
    }
    checked.push(path.relative(distDir, resolved))
  }
  REQUIRED_ROUTE_FILES.forEach((file) => visit(file, true))
  OPTIONAL_ROUTE_FILES.forEach((file) => visit(file, false))
  return { ok: failures.length === 0, name, checked, skipped, failures }
}

function parseArgs(argv) {
  const distIndex = argv.indexOf('--dist')
  const dist = distIndex >= 0 ? argv[distIndex + 1] : 'dist'
  return { distDir: path.resolve(process.cwd(), dist || 'dist') }
}

function main() {
  const { distDir } = parseArgs(process.argv.slice(2))
  const result = checkDist(distDir)
  result.checked.forEach((file) => {
    console.log(`✅ guard-site-owner-name: ${file} содержит «${result.name}»`)
  })
  result.skipped.forEach((file) => {
    console.log(`ℹ️  guard-site-owner-name: ${file} в экспорте нет, пропущен`)
  })
  if (!result.ok) {
    console.error('❌ guard-site-owner-name: имя владельца сайта не найдено в статическом HTML')
    result.failures.forEach((line) => console.error(`   - ${line}`))
    console.error('   Источник имени — constants/legal.json; главная берёт его из scripts/ssg-skeletons.js, /contact и /about — из components/about/AboutIntroCard.tsx (#1999).')
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { checkDist, checkHomeHtml, checkRouteHtml, resolveRouteFile, REQUIRED_ROUTE_FILES, OPTIONAL_ROUTE_FILES, HOME_LEGAL_MARKER }
