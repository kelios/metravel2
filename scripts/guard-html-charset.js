#!/usr/bin/env node

// #2088: HTML5 encoding sniffing only scans the first 1024 bytes of a
// document (https://html.spec.whatwg.org/multipage/parsing.html#prescan-a-byte-stream-to-determine-its-encoding).
// Expo Router's static export can insert Helmet's per-page tags ahead of the
// <meta charset> declared in app/+html.tsx (see scripts/lib/htmlCharset.js
// for the mechanism and the fix). This guard is the regression control: it
// fails the build if a produced HTML file still declares its charset past
// that boundary, instead of shipping a page that risks a mis-detected
// encoding and a wasted re-parse.

const fs = require('fs')
const path = require('path')
const { listHtmlFiles } = require('./lib/listHtmlFiles')

const PRESCAN_BYTES = 1024

// Scoped to a <meta ...> tag, not a bare "charset=" substring: an unscoped
// check would false-pass a page with NO charset declaration at all if the
// first 1024 bytes happen to contain "charset=" outside a meta tag (e.g. a
// query string on a stylesheet/font link, inline JSON-LD, or GTM script
// text). `[^>]` bars the scan from crossing into a later tag, so a `<meta>`
// without a charset attribute can't make a later unrelated tag's charset
// count as "found early".
const META_CHARSET_RE = /<meta\b[^>]*charset\s*=/i

// Byte offset, not character offset: Helmet-managed Cyrillic title/description
// tags are multi-byte in UTF-8, so a character-based check would under-count
// how far into the document the charset declaration actually sits.
function hasCharsetWithinPrescan(absPath) {
  const buffer = fs.readFileSync(absPath)
  const prescan = buffer.subarray(0, PRESCAN_BYTES).toString('latin1')
  return META_CHARSET_RE.test(prescan)
}

function checkDist(distDir) {
  if (!fs.existsSync(distDir)) {
    throw new Error(`dist directory not found: ${distDir}`)
  }
  const files = listHtmlFiles(distDir, 'check for charset position')
  const violations = files
    .filter((absPath) => !hasCharsetWithinPrescan(absPath))
    .map((absPath) => path.relative(distDir, absPath).split(path.sep).join('/'))
  return { ok: violations.length === 0, total: files.length, violations }
}

function parseArgs(argv) {
  const distIndex = argv.indexOf('--dist')
  const dist = distIndex >= 0 ? argv[distIndex + 1] : 'dist/prod'
  return { distDir: path.resolve(process.cwd(), dist || 'dist/prod') }
}

function main() {
  const { distDir } = parseArgs(process.argv.slice(2))
  const result = checkDist(distDir)
  if (!result.ok) {
    console.error(
      `❌ guard-html-charset: ${result.violations.length} из ${result.total} HTML-файлов объявляют charset дальше ${PRESCAN_BYTES} байт от начала:`
    )
    result.violations.forEach((file) => console.error(`   - ${file}`))
    console.error(
      '   Причина — Helmet-теги (data-rh) статического рендера Expo Router встают перед <meta charset> из app/+html.tsx на страницах с длинным description/og:description. Постобработка — scripts/lib/htmlCharset.js, вызывается из scripts/add-cache-bust-meta.js (#2088).'
    )
    process.exit(1)
  }
  console.log(`✅ guard-html-charset: charset в первых ${PRESCAN_BYTES} байт на всех ${result.total} HTML-файлах.`)
}

if (require.main === module) {
  main()
}

module.exports = { checkDist, hasCharsetWithinPrescan, PRESCAN_BYTES }
