#!/usr/bin/env node

const fs = require('fs')

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

const pickLcpElement = (report) => {
  const outerItems = report?.audits?.['largest-contentful-paint-element']?.details?.items
  // Lighthouse uses a table format: details.items = [{ type:'table', items:[{ node: ... }] }, ...]
  const node = outerItems?.[0]?.items?.[0]?.node
  if (!node) return null
  return {
    selector: node.selector,
    snippet: node.snippet,
    boundingRect: node.boundingRect,
  }
}

const pickLcpLazyLoaded = (report) => {
  const audit = report?.audits?.['lcp-lazy-loaded']
  if (!audit) return null

  const outerItems = audit?.details?.items
  // Same table format as LCP element.
  const node = outerItems?.[0]?.items?.[0]?.node

  return {
    score: audit.score,
    node: node
      ? {
          selector: node.selector,
          snippet: node.snippet,
        }
      : null,
  }
}

const print = (label, report) => {
  console.log(`\n${label}`)
  console.log('url:', report?.finalUrl)
  console.log('LCP element:', pickLcpElement(report))
  console.log('lcp-lazy-loaded:', pickLcpLazyLoaded(report))
}

try {
  const mobile = readJson('./lighthouse-report.produrl.mobile.json')
  const desktop = readJson('./lighthouse-report.produrl.desktop.json')

  print('mobile', mobile)
  print('desktop', desktop)
} catch (error) {
  console.error('❌ Failed to read lighthouse produrl reports:', error)
  process.exit(1)
}
