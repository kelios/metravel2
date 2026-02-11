#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DEFAULT_BUILD_DIR = path.join(__dirname, '..', 'dist', 'prod')
const buildDirArg = process.argv[2] ? String(process.argv[2]).trim() : ''
const buildDir = buildDirArg ? path.resolve(buildDirArg) : DEFAULT_BUILD_DIR

if (!fs.existsSync(buildDir)) {
  console.error(`❌ Build directory not found: ${buildDir}`)
  process.exit(1)
}

const htmlFiles = []

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(p)
      continue
    }
    if (entry.isFile() && p.endsWith('.html')) {
      htmlFiles.push(p)
    }
  }
}

walk(buildDir)

if (htmlFiles.length === 0) {
  console.log('ℹ️ No HTML files found to postprocess.')
  process.exit(0)
}

const STYLE_RE = /<style id="react-native-stylesheet">([\s\S]*?)<\/style>/i
const injectedHashes = new Set()
let processedCount = 0
let extractedCount = 0

for (const htmlPath of htmlFiles) {
  const html = fs.readFileSync(htmlPath, 'utf8')
  const match = html.match(STYLE_RE)
  if (!match) continue

  const cssText = String(match[1] || '')
  if (!cssText.trim()) continue

  const hash = crypto.createHash('sha256').update(cssText).digest('hex').slice(0, 16)
  const cssDir = path.join(buildDir, '_expo', 'static', 'css')
  const cssFileName = `rnw-${hash}.css`
  const cssFilePath = path.join(cssDir, cssFileName)
  const cssHref = `/_expo/static/css/${cssFileName}`

  fs.mkdirSync(cssDir, { recursive: true })
  if (!fs.existsSync(cssFilePath)) {
    fs.writeFileSync(cssFilePath, cssText)
    extractedCount += 1
  }

  const replacement =
    `<link rel="preload" as="style" href="${cssHref}">` +
    `<link rel="stylesheet" href="${cssHref}" media="print" data-rnw-styles="1" onload="this.media='all';this.setAttribute('data-loaded','1');document.documentElement.classList.add('rnw-styles-ready')">` +
    `<noscript><link rel="stylesheet" href="${cssHref}"></noscript>`

  let updated = html.replace(STYLE_RE, replacement)

  // Remove duplicate style preload blocks if file was already processed.
  if (injectedHashes.has(hash)) {
    const dedupeRe = new RegExp(
      `<link rel="preload" as="style" href="${cssHref}">` +
        `<link rel="stylesheet" href="${cssHref}" media="print" data-rnw-styles="1" onload="this.media='all';this.setAttribute('data-loaded','1');document.documentElement.classList.add('rnw-styles-ready')">` +
        `<noscript><link rel="stylesheet" href="${cssHref}"><\\/noscript>`,
      'g'
    )
    let first = true
    updated = updated.replace(dedupeRe, (m) => {
      if (first) {
        first = false
        return m
      }
      return ''
    })
  }

  fs.writeFileSync(htmlPath, updated)
  injectedHashes.add(hash)
  processedCount += 1
}

console.log(`✅ Postprocessed HTML files: ${processedCount}`)
console.log(`✅ Extracted RNW stylesheet variants: ${extractedCount}`)
