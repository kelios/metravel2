#!/usr/bin/env node

// #2689: every exported page must carry exactly one <meta name="description">
// (a noindex page — redirect stub, quest error page — may carry none, never two).
// app/+html.tsx adds a site-wide default next to the page's own Helmet tag;
// scripts/lib/htmlMetaDescription.js strips the extra one in the last full
// pass over dist (scripts/add-cache-bust-meta.js). This guard is the
// regression control: a new route, a new post-processing step or a changed
// shell that brings the duplicate (or loses the tag) back fails the build
// instead of shipping a page whose snippet a crawler may take from the wrong
// description.

const fs = require('fs')
const path = require('path')
const { listHtmlFiles } = require('./lib/listHtmlFiles')
const { countMetaDescriptions, countTitles, isNoindex } = require('./lib/htmlMetaDescription')

function checkDist(distDir) {
  if (!fs.existsSync(distDir)) {
    throw new Error(`dist directory not found: ${distDir}`)
  }
  const files = listHtmlFiles(distDir, 'check for meta description count')
  // SSG writes flat and directory-index routes as hardlinks: read each inode once.
  const verdicts = new Map()
  const violations = files
    .map((absPath) => {
      const stats = fs.statSync(absPath, { bigint: true })
      const inode = `${stats.dev}:${stats.ino}`
      if (!verdicts.has(inode)) {
        const html = fs.readFileSync(absPath, 'utf8')
        const count = countMetaDescriptions(html)
        // #2740: every exported page also carries exactly one non-empty <title>.
        const titles = countTitles(html)
        const descriptionOk = count === 1 || (count === 0 && isNoindex(html))
        const titleOk = (titles.total === 1 && titles.nonEmpty === 1) || (titles.total === 0 && isNoindex(html))
        verdicts.set(inode, { count, titles: titles.total, ok: descriptionOk && titleOk })
      }
      const { count, titles, ok } = verdicts.get(inode)
      return { file: path.relative(distDir, absPath).split(path.sep).join('/'), count, titles, ok }
    })
    .filter(({ ok }) => !ok)
    .map(({ file, count, titles }) => ({ file, count, titles }))
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
      `❌ guard-html-meta-description: ${result.violations.length} из ${result.total} HTML-файлов содержат не ровно один <meta name="description"> (без него можно только noindex-странице) или не ровно один непустой <title>:`
    )
    result.violations.forEach(({ file, count, titles }) => console.error(`   - ${file}: description=${count}, title=${titles}`))
    console.error(
      '   Дефолтный description из app/+html.tsx снимается в scripts/lib/htmlMetaDescription.js (вызов — scripts/add-cache-bust-meta.js); страница без своего description получает дефолт (#2689).'
    )
    process.exit(1)
  }
  console.log(`✅ guard-html-meta-description: ровно один meta description и один <title> на всех ${result.total} HTML-файлах.`)
}

if (require.main === module) {
  main()
}

module.exports = { checkDist }
