#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const WAIT_FOR_TIMEOUT_CALL = /\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\(\))*\.waitForTimeout\s*\(/g

const WAIT_FOR_TIMEOUT_BASELINE = {
  'e2e/a11y-audit.spec.ts': 1,
  'e2e/article-anchor-scroll.spec.ts': 1,
  'e2e/article-editor-browser-actions.spec.ts': 2,
  'e2e/auth-entrypoints.spec.ts': 1,
  'e2e/auth-hydration.spec.ts': 1,
  'e2e/auth-logout.spec.ts': 1,
  'e2e/calendar.spec.ts': 3,
  'e2e/cls-audit.spec.ts': 1,
  'e2e/draft-recovery.spec.ts': 1,
  'e2e/footer-layout-invariants.spec.ts': 5,
  'e2e/footer-more.spec.ts': 1,
  'e2e/footer-navigation.spec.ts': 1,
  'e2e/gallery-delete-broken-image.spec.ts': 1,
  'e2e/global-setup.ts': 1,
  'e2e/helpers/e2eApi.ts': 3,
  'e2e/helpers/navigation.ts': 7,
  'e2e/home-mood-back-affordance.spec.ts': 1,
  'e2e/home-quick-filters-nightstay.spec.ts': 1,
  'e2e/hydration-routes.spec.ts': 2,
  'e2e/layout-responsive.spec.ts': 2,
  'e2e/map-mobile-panel-content.spec.ts': 2,
  'e2e/map-mobile-route-toolbar.spec.ts': 3,
  'e2e/map-page.spec.ts': 8,
  'e2e/map-popup-close.spec.ts': 1,
  'e2e/map-server-text-search-701.spec.ts': 1,
  'e2e/map-travel-card-no-image.spec.ts': 1,
  'e2e/messages-conversation.spec.ts': 6,
  'e2e/messages-keyboard-inset.spec.ts': 2,
  'e2e/mobile-regression-android-qa.spec.ts': 2,
  'e2e/pages-perf-budget-negative.spec.ts': 1,
  'e2e/pages-perf-budget.spec.ts': 1,
  'e2e/planned-trip-point-density.spec.ts': 1,
  'e2e/planned-trip-route-truthfulness.spec.ts': 1,
  'e2e/prod-media-smoke.spec.ts': 5,
  'e2e/profile-awards-hub.spec.ts': 11,
  'e2e/profile-engagement-detail-1192.spec.ts': 2,
  'e2e/profile-redesign-587-590.spec.ts': 4,
  'e2e/profile-worldmap-635.spec.ts': 9,
  'e2e/public-trips.spec.ts': 1,
  'e2e/qa-1511-autosave-storm.spec.ts': 1,
  'e2e/quest-finale-share-sheet.spec.ts': 1,
  'e2e/render-audit.spec.ts': 1,
  'e2e/search.spec.ts': 2,
  'e2e/seo-travel-detail.spec.ts': 1,
  'e2e/skeleton-transition.spec.ts': 1,
  'e2e/travel-content-save-delta.spec.ts': 2,
  'e2e/travel-details-deferred-upstream-cls.spec.ts': 2,
  'e2e/travel-details-network-isolation.spec.ts': 1,
  'e2e/travel-details-no-home-flicker.spec.ts': 1,
  'e2e/travel-details-rn-web-console.spec.ts': 3,
  'e2e/travel-full-flow.spec.ts': 1,
  'e2e/travel-gallery-swipe-mobile.spec.ts': 4,
  'e2e/travel-map-popup-close.spec.ts': 1,
  'e2e/travel-wizard-draft-f09-verify.spec.ts': 2,
  'e2e/travel-wizard-point-photo-isolation.live.spec.ts': 2,
  'e2e/travels-pagination.spec.ts': 4,
  'e2e/ui-layout-regressions.spec.ts': 1,
  'e2e/user-points-import.spec.ts': 3,
  'e2e/user-points.spec.ts': 4,
  'e2e/web-scroll-delegation.spec.ts': 4,
  'e2e/web-vitals-list.spec.ts': 1,
}

const TARGET_ZERO_FILES = [
  'e2e/slider-comprehensive.spec.ts',
  'e2e/slider-swipe.spec.ts',
  'e2e/travel-wizard.spec.ts',
]

function walkE2EFiles(rootDir, relativeDir = 'e2e') {
  const absoluteDir = path.join(rootDir, relativeDir)
  if (!fs.existsSync(absoluteDir)) return []

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(relativeDir, entry.name)
    if (entry.isDirectory()) return walkE2EFiles(rootDir, relativePath)
    return entry.name.endsWith('.ts') ? [relativePath] : []
  })
}

function countWaitForTimeoutCalls(source) {
  const code = stripJavaScriptComments(source)
  WAIT_FOR_TIMEOUT_CALL.lastIndex = 0
  return (code.match(WAIT_FOR_TIMEOUT_CALL) ?? []).length
}

function stripJavaScriptComments(source) {
  let out = ''
  let quote = ''
  let escaped = false

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index]
    const next = source[index + 1]

    if (quote) {
      out += current
      if (escaped) {
        escaped = false
      } else if (current === '\\') {
        escaped = true
      } else if (current === quote) {
        quote = ''
      }
      continue
    }

    if (current === '"' || current === "'" || current === '`') {
      quote = current
      out += current
      continue
    }

    if (current === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1
      out += '\n'
      continue
    }

    if (current === '/' && next === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') out += '\n'
        index += 1
      }
      index += 1
      continue
    }

    out += current
  }

  return out
}

function collectWaitForTimeoutCounts(rootDir) {
  const counts = {}
  for (const file of walkE2EFiles(rootDir).sort()) {
    const count = countWaitForTimeoutCalls(fs.readFileSync(path.join(rootDir, file), 'utf8'))
    if (count > 0) counts[file] = count
  }
  return counts
}

function findViolations(counts, baseline = WAIT_FOR_TIMEOUT_BASELINE) {
  const violations = []
  for (const [file, count] of Object.entries(counts)) {
    const allowed = baseline[file] ?? 0
    if (count > allowed) {
      violations.push(`${file}: ${count} waitForTimeout calls, allowed ${allowed}`)
    }
  }

  for (const file of TARGET_ZERO_FILES) {
    const count = counts[file] ?? 0
    if (count !== 0) {
      violations.push(`${file}: task #1832 requires 0 waitForTimeout calls, found ${count}`)
    }
  }

  return violations
}

function main() {
  const rootDir = path.resolve(__dirname, '..')
  const counts = collectWaitForTimeoutCounts(rootDir)
  const violations = findViolations(counts)

  if (violations.length > 0) {
    console.error('[guard-e2e-wait-for-timeout] FAIL: new hard E2E waits are not allowed')
    for (const violation of violations) console.error(`- ${violation}`)
    console.error('Replace the sleep with a condition-based wait, or lower the baseline when removing old debt.')
    process.exit(1)
  }

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  console.log(`[guard-e2e-wait-for-timeout] OK: ${total} existing waitForTimeout calls, no growth`)
}

if (require.main === module) main()

module.exports = {
  WAIT_FOR_TIMEOUT_BASELINE,
  TARGET_ZERO_FILES,
  collectWaitForTimeoutCounts,
  countWaitForTimeoutCalls,
  findViolations,
  stripJavaScriptComments,
}
