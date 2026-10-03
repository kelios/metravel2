#!/usr/bin/env node
/**
 * #2120 / MODAL-TOP-INSET-001: внутри `<Modal>` безопасная зона — только
 * `components/ui/ModalSafeArea`.
 *
 * Нативный `SafeAreaView` (из `react-native-safe-area-context` и из
 * `react-native`) внутри `Modal` на iOS не видит корневой провайдер: модальное
 * окно живёт в отдельной иерархии вью, отступ снимается в момент появления, пока
 * окно ещё выезжает, и верх остаётся нулевым — шапка «Закрыть»/«Готово» ложится
 * под статус-бар (замер на iPhone 17 Pro iOS 26.5: рамка с y=0 при корневом
 * insets.top = 62). `ModalSafeArea` берёт отступы корневого контекста.
 *
 * Проверка структурная по AST TSX: элемент `SafeAreaView` (или `RN.SafeAreaView`)
 * среди потомков элемента `Modal`.
 * `SafeAreaView` вне `Modal` (экраны, док) не ошибка.
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const SCAN_DIRS = ['app', 'components', 'screens']
const SOURCE = new Set(['.jsx', '.tsx'])
const ALLOW_FILES = new Map([
  [
    'components/article/ArticleEditor.web.parts.tsx',
    'web-only: Modal на web рендерится в DOM-портал страницы, нативной иерархии вью и iOS-статус-бара нет',
  ],
])

const ts = require('typescript')

const tagName = (node) => (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText()

const violations = []

/** Ищет JSX-элементы `Modal`, внутри которых есть `SafeAreaView`, по AST TSX. */
const checkFile = (rel, text) => {
  const source = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const visit = (node, insideModal) => {
    let inside = insideModal
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = tagName(node)
      if (insideModal && /(^|\.)SafeAreaView$/.test(name)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
        violations.push(`${rel}:${line + 1}: ${name} внутри Modal — используйте components/ui/ModalSafeArea`)
      }
      if (/(^|\.)Modal$/.test(name)) inside = true
    }
    ts.forEachChild(node, (child) => visit(child, inside))
  }
  visit(source, false)
}

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
    if (ALLOW_FILES.has(rel)) continue
    const text = fs.readFileSync(full, 'utf8')
    if (!text.includes('<Modal') || !text.includes('SafeAreaView')) continue
    checkFile(rel, text)
  }
}

if (require.main === module) {
  for (const dir of SCAN_DIRS) {
    const full = path.join(ROOT, dir)
    if (fs.existsSync(full)) walk(full)
  }

  if (violations.length) {
    console.error('guard:modal-safe-area: нативная безопасная зона внутри Modal (MODAL-TOP-INSET-001)')
    for (const item of violations) console.error(`  ${item}`)
    process.exit(1)
  }

  console.log('guard:modal-safe-area: ok')
}

module.exports = { checkFile, violations }
