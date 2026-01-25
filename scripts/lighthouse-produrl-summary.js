#!/usr/bin/env node

const fs = require('fs')

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

const perfScore = (report) => {
  const score = report?.categories?.performance?.score
  return Math.round((typeof score === 'number' ? score : 0) * 100)
}

const numeric = (report, auditId) => report?.audits?.[auditId]?.numericValue

const fmt = (value) => {
  if (value === undefined || value === null) return 'n/a'
  if (typeof value === 'number') {
    return value >= 1 ? String(Math.round(value)) : String(value)
  }
  return String(value)
}

const summarize = (label, report) => {
  const summary = {
    score: perfScore(report),
    fcp: numeric(report, 'first-contentful-paint'),
    lcp: numeric(report, 'largest-contentful-paint'),
    tbt: numeric(report, 'total-blocking-time'),
    cls: numeric(report, 'cumulative-layout-shift'),
    si: numeric(report, 'speed-index'),
  }

  console.log(
    `${label}:`,
    `score=${summary.score}`,
    `LCP=${fmt(summary.lcp)}ms`,
    `FCP=${fmt(summary.fcp)}ms`,
    `TBT=${fmt(summary.tbt)}ms`,
    `CLS=${fmt(summary.cls)}`,
    `SI=${fmt(summary.si)}ms`
  )
}

try {
  const mobile = readJson('./lighthouse-report.produrl.mobile.json')
  const desktop = readJson('./lighthouse-report.produrl.desktop.json')

  summarize('mobile', mobile)
  summarize('desktop', desktop)
} catch (error) {
  console.error('❌ Failed to read lighthouse produrl reports:', error)
  process.exit(1)
}
