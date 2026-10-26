#!/usr/bin/env node
// Выносит одинаковые на всех страницах <style> из <head> в общие файлы
// /_expo/static/css/<prefix>-<sha256>.css (#2762).
//
// Зачем: каждая из ~3 700 SSG-страниц несла одни и те же стили — таблицу
// react-native-web (56 КБ), critical CSS (16 КБ) и CSS первого кадра (42 КБ).
// Это ~250 МБ одинакового текста в каждом поколении quest v1, а поколения
// делят только целые файлы: HTML меняется в каждой сборке (build-version,
// хеши чанков), поэтому пик выката «два поколения + новое» упёрся в бюджет
// владельца 1536 МиБ. Общий файл с хешем содержимого в имени лежит один раз
// на поколение и отдаётся nginx как immutable.
//
// Как: <style id="X">…</style> → <link rel="stylesheet" id="X" href="…"> на
// том же месте. Это обычная render-blocking таблица (не media=print/onload —
// тот вариант давал вспышку нестилизованного контента и был снят), поэтому
// каскад и первый кадр прежние. id сохраняется: react-native-web находит свою
// таблицу через getElementById(...).sheet и при гидрации читает её cssRules,
// у <link> они те же; скрипт снятия скелета удаляет #ssg-skeleton-css. Если
// файл не загрузился, onerror ставит на место пустой <style> с тем же id —
// иначе RNW упал бы на sheet === null, а так он сам вставит нужные правила
// при рендере.
//
// Использование: node scripts/externalize-head-styles.js <dist>

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const EXTERNALIZED_STYLES = Object.freeze([
  { id: 'react-native-stylesheet', prefix: 'rnw' },
  { id: 'metravel-critical-css', prefix: 'critical' },
  { id: 'ssg-skeleton-css', prefix: 'ssg-skeleton' },
])
// Мелкий блок дешевле оставить в HTML, чем платить за отдельный запрос.
const MIN_EXTERNAL_BYTES = 2048
const CSS_URL_DIR = '/_expo/static/css'
const LINK_FALLBACK =
  "var s=document.createElement('style');s.id=this.id;this.parentNode.replaceChild(s,this)"

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const stylePatterns = EXTERNALIZED_STYLES.map((style) => ({
  ...style,
  pattern: new RegExp(`<style id="${escapeRegExp(style.id)}">([\\s\\S]*?)</style>`, 'g'),
}))

/**
 * @param {string} html
 * @returns {{ html: string, assets: Array<{ fileName: string, css: string }> }}
 */
function externalizeHeadStyles(html) {
  const assets = []
  let result = html
  for (const { id, prefix, pattern } of stylePatterns) {
    const matches = [...result.matchAll(pattern)]
    if (matches.length === 0) continue
    if (matches.length > 1) throw new Error(`externalize-head-styles: <style id="${id}"> встречается ${matches.length} раза`)
    const [block, css] = matches[0]
    if (Buffer.byteLength(css) < MIN_EXTERNAL_BYTES) continue
    const hash = crypto.createHash('sha256').update(css).digest('hex').slice(0, 16)
    const fileName = `${prefix}-${hash}.css`
    assets.push({ fileName, css })
    const link = `<link rel="stylesheet" id="${id}" href="${CSS_URL_DIR}/${fileName}" onerror="${LINK_FALLBACK}">`
    // Функция-заменитель: в CSS законно встречаются `$&`/`$'`, которые строка
    // замены развернула бы в куски документа (#1356).
    result = result.replace(block, () => link)
  }
  return { html: result, assets }
}

function listHtmlFiles(root) {
  const out = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (absolute !== path.join(root, '_expo')) walk(absolute)
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        out.push(absolute)
      }
    }
  }
  walk(root)
  return out.sort()
}

function externalizeDist(distDir) {
  const cssDir = path.join(distDir, ...CSS_URL_DIR.split('/').filter(Boolean))
  const written = new Map()
  let pages = 0
  let savedBytes = 0
  for (const htmlPath of listHtmlFiles(distDir)) {
    const before = fs.readFileSync(htmlPath, 'utf8')
    const { html, assets } = externalizeHeadStyles(before)
    if (assets.length === 0) continue
    for (const { fileName, css } of assets) {
      const known = written.get(fileName)
      if (known === undefined) {
        fs.mkdirSync(cssDir, { recursive: true })
        const target = path.join(cssDir, fileName)
        if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') !== css) {
          throw new Error(`externalize-head-styles: ${fileName} уже есть с другим содержимым`)
        }
        fs.writeFileSync(target, css)
        written.set(fileName, css)
      } else if (known !== css) {
        throw new Error(`externalize-head-styles: коллизия хеша ${fileName}`)
      }
    }
    fs.writeFileSync(htmlPath, html)
    pages += 1
    savedBytes += Buffer.byteLength(before) - Buffer.byteLength(html)
  }
  return { pages, files: [...written.keys()].sort(), savedBytes }
}

if (require.main === module) {
  const distArg = process.argv[2]
  if (!distArg) {
    console.error('Usage: node scripts/externalize-head-styles.js <dist>')
    process.exit(2)
  }
  const distDir = path.resolve(distArg)
  if (!fs.statSync(distDir, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`❌ externalize-head-styles: нет каталога ${distDir}`)
    process.exit(1)
  }
  const { pages, files, savedBytes } = externalizeDist(distDir)
  console.log(
    `✅ Общие стили вынесены из ${pages} HTML в ${files.length} файл(ов) ${CSS_URL_DIR}: ` +
      `HTML легче на ${Math.round(savedBytes / 1048576)} МБ (${files.join(', ') || '—'})`,
  )
}

module.exports = { EXTERNALIZED_STYLES, MIN_EXTERNAL_BYTES, externalizeHeadStyles, externalizeDist }
