#!/usr/bin/env node
/**
 * #2097 / MOBILE-INSETS-001: нижний резерв под доком читается только через
 * useBottomChromeInset / useScrollBottomPadding / useDockReservePx.
 * Локальные LAYOUT.tabBarHeight, BOTTOM_DOCK_HEIGHT и «56 рядом с insets»
 * снова прячут последнюю кнопку под док.
 *
 * Док сам (BottomDock, его fallback в Footer и RootWebDeferredChrome) и
 * модуль хука константу читать могут. Клавиатура (#1072) и оверлеи поверх
 * всего экрана резервируют home indicator, а не док — они в SAFE_AREA_ONLY.
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const SCAN_DIRS = ['app', 'components', 'screens']
const ALLOW_FILES = new Set([
  'components/layout/bottomDockModel.ts',
  'components/layout/bottomChromeInset.tsx',
  'components/layout/BottomDock.tsx',
  'components/layout/Footer.tsx',
  'components/layout/RootWebDeferredChrome.tsx',
])
const SAFE_AREA_ONLY = new Set([
  'components/travel/FullscreenGallery.tsx',
  'components/navigation/OpenInMapsSheet.tsx',
  'components/quests/ShareQuestResultSheet.tsx',
  'components/quests/QuestFullMap.tsx',
  'components/trips/planning/TripPlanRouteMap.tsx',
  'components/quests/hooks/useQuestKeyboardReveal.ts',
  'components/layout/CustomHeaderMobileMenu.tsx',
])

const SOURCE = new Set(['.js', '.jsx', '.ts', '.tsx'])

const violations = []

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
      continue
    }
    if (!SOURCE.has(path.extname(entry.name))) continue
    const rel = path.relative(ROOT, full).split(path.sep).join('/')
    if (ALLOW_FILES.has(rel) || SAFE_AREA_ONLY.has(rel)) continue
    const text = fs.readFileSync(full, 'utf8')
    const lines = text.split('\n')
    lines.forEach((line, index) => {
      const code = line.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/, '')
      if (!code.trim()) return
      const dockSymbol = /LAYOUT\??\.tabBarHeight|\bBOTTOM_DOCK_HEIGHT\b|\bDOCK_CONTENT_HEIGHT\b/.test(code)
      const dockLiteralWithInsets = /insets\.bottom[\s\S]{0,40}\b56\b|\b56\b[\s\S]{0,40}insets\.bottom/.test(code)
      const namedDockLiteral = /(?:DOCK|TAB_BAR|FOOTER_RESERVE)[A-Z0-9_]*\s*=\s*56\b/.test(code)
      if (dockSymbol || dockLiteralWithInsets || namedDockLiteral) {
        violations.push(`${rel}:${index + 1}: ${line.trim()}`)
      }
    })
  }
}

for (const dir of SCAN_DIRS) {
  const full = path.join(ROOT, dir)
  if (fs.existsSync(full)) walk(full)
}

if (violations.length) {
  console.error('guard:bottom-chrome-inset: локальный расчёт высоты дока')
  for (const item of violations) console.error(`  ${item}`)
  process.exit(1)
}

console.log('guard:bottom-chrome-inset: ok')
