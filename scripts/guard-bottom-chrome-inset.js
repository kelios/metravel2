#!/usr/bin/env node
/**
 * #2097 / MOBILE-INSETS-001: нижний резерв под доком читается только через
 * useBottomChromeInset / useScrollBottomPadding / useDockReservePx.
 * Локальные LAYOUT.tabBarHeight, BOTTOM_DOCK_HEIGHT и «56 рядом с insets»
 * снова прячут последнюю кнопку под док.
 *
 * #2153: то же для нижних листов и оверлеев — литерал высоты дока в тернарнике
 * `bottom` / `marginBottom` (`IS_WEB ? 58 : 0`) держит лист над краем там, где
 * дока нет. Отступ листа — `useBottomChromeInset()` (см. `components/ui/BottomSheet`).
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
  // #2216: lightweight canonical definition + actual persistent web dock producer.
  'components/layout/bottomDockItemDefs.ts',
  'components/layout/WebMobileDockShell.tsx',
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

const WEB_DOCK_ANCHORS = new Set([
  'components/layout/ConsentBanner.tsx',
  'components/layout/AppInstallBar.tsx',
  'components/ui/ToastHost.web.tsx',
])

const SOURCE = new Set(['.js', '.jsx', '.ts', '.tsx'])

/** Строка кода без комментариев; `null`, если от строки ничего не осталось. */
const stripLineComments = (line) => {
  const code = line.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/, '')
  return code.trim() ? code : null
}

/** Локальный расчёт высоты дока в одной строке кода (без комментариев). */
const lineComputesDockHeight = (code) => {
  const dockSymbol = /LAYOUT\??\.tabBarHeight|\bBOTTOM_DOCK_HEIGHT\b|\bDOCK_CONTENT_HEIGHT\b/.test(code)
  const dockLiteralWithInsets = /insets\.bottom[\s\S]{0,40}\b56\b|\b56\b[\s\S]{0,40}insets\.bottom/.test(code)
  const namedDockLiteral = /(?:DOCK|TAB_BAR|FOOTER_RESERVE)[A-Z0-9_]*\s*=\s*56\b/.test(code)
  // #2153: `marginBottom: bottomOffset ?? (IS_WEB ? 58 : 0)` — высота дока (56 и
  // 58 с рамкой) как ветка тернарника в нижнем отступе.
  const dockLiteralInBottomTernary = /\b(?:marginBottom|bottom)\b\s*:[^\n]*\?\s*(?:56|58)\b/.test(code)
  return dockSymbol || dockLiteralWithInsets || namedDockLiteral || dockLiteralInBottomTernary
}

/** Нарушения в тексте одного файла: `rel:line: исходная строка`. */
const findViolationsInSource = (rel, text) => {
  const found = []
  text.split('\n').forEach((line, index) => {
    const code = stripLineComments(line)
    if (code && (lineComputesDockHeight(code) ||
      (WEB_DOCK_ANCHORS.has(rel) && /\bbottom\s*:\s*(?:56|58|64|72)\b/.test(code)))) found.push(`${rel}:${index + 1}: ${line.trim()}`)
  })
  return found
}

const collectViolations = (rootDir = ROOT) => {
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
      const rel = path.relative(rootDir, full).split(path.sep).join('/')
      if (ALLOW_FILES.has(rel) || SAFE_AREA_ONLY.has(rel)) continue
      violations.push(...findViolationsInSource(rel, fs.readFileSync(full, 'utf8')))
    }
  }
  for (const dir of SCAN_DIRS) {
    const full = path.join(rootDir, dir)
    if (fs.existsSync(full)) walk(full)
  }
  return violations
}

function main() {
  const violations = collectViolations()
  if (violations.length) {
    console.error('guard:bottom-chrome-inset: локальный расчёт высоты дока')
    for (const item of violations) console.error(`  ${item}`)
    process.exit(1)
  }
  console.log('guard:bottom-chrome-inset: ok')
}

if (require.main === module) main()

module.exports = {
  collectViolations,
  findViolationsInSource,
  lineComputesDockHeight,
}
