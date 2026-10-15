#!/usr/bin/env node
// #2440: native Modal feedback must live in the retained presentation layer.
// Registered roots are checked structurally, including visibility and imports.
// New direct toast/action/report consumers in a native Modal require a policy;
// web-only branches are proved from their source rather than exempted by name.
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const MODAL_FEEDBACK_ROOTS = [
  ['components/travel/FullscreenGallery.tsx', 'visible'],
  ['components/quests/QuestModalSheet.tsx', 'visible'],
  ['components/travel/stepRoute/PointEditorSheet.tsx', 'visible'],
  ['components/MapPage/TravelMap.native.tsx', 'Boolean(selectedPoint)'],
  ['components/achievements/ShareBadgeSheet.tsx', 'visible'],
  ['components/achievements/PeerBadgePickerSheet.tsx', 'visible'],
  ['components/quests/ShareQuestResultSheet.tsx', 'visible'],
  ['components/article/ArticleEditor.ios.tsx', 'anchorModalVisible'],
  ['components/travel/ContentUpsertSection.tsx', 'isDescriptionFullscreen'],
  ['components/quests/QuestFullMap.native.tsx', 'fullscreenVisible'],
].map(([file, visible]) => ({ file, visible, policy: 'host' }))

// These are lifecycle policies, not permission to leave a retained modal unhosted.
const TRANSIENT_MODALS = [
  {
    file: 'components/safety/ReportReasonSheet.tsx', visible: 'visible', policy: 'report-parent',
    reason: 'Success closes this temporary reason sheet; the toast belongs to its retained parent (or app root). A host here would disappear on success.',
  },
  {
    file: 'components/quests/QuestFullMap.native.tsx', visible: 'exportMenuVisible', policy: 'export-parent',
    reason: 'Every export action closes this menu first; fullscreen export feedback belongs to the retained fullscreenVisible modal above.',
  },
  {
    file: 'components/travel/TravelStatusButton.tsx', visible: 'modalOpen', policy: 'status-parent',
    reason: 'Every status mutation closes the temporary sheet before run(); feedback belongs to the retained parent or app root.',
  },
]

const normalize = (value) => value.replace(/\s+/g, '')
const jsxName = (node) => (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText()
const opening = (node) => ts.isJsxElement(node) ? node.openingElement : node
const attribute = (node, name) => {
  const attr = opening(node).attributes.properties.find((item) => ts.isJsxAttribute(item) && item.name.getText() === name)
  if (!attr) return undefined
  if (!attr.initializer) return 'true'
  return normalize(ts.isJsxExpression(attr.initializer) ? attr.initializer.expression?.getText() ?? '' : attr.initializer.getText())
}

function sourceInfo(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const nativeModals = new Set()
  const bottomSheets = new Set()
  const hosts = new Set()
  const rawHosts = new Set()
  const feedback = new Set()
  const webAliases = new Set()
  source.statements.forEach((node) => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return
    const module = node.moduleSpecifier.text
    const clause = node.importClause
    if (module === 'react-native' && clause?.name) nativeModals.add(`${clause.name.text}.Modal`)
    // BottomSheet owns a native Modal too. Its modalContent slot retains hosts
    // and nested presentations at the full-screen layer, outside the panel.
    if (module === '@/components/ui/BottomSheet' && clause?.name) {
      nativeModals.add(clause.name.text)
      bottomSheets.add(clause.name.text)
    }
    if (module === 'react-native-toast-message' && clause?.name) {
      rawHosts.add(clause.name.text)
      feedback.add(`${clause.name.text}.show`)
    }
    if (module === '@/components/ui/ModalToastHost' && clause?.name) hosts.add(clause.name.text)
    if (module === '@/components/ui/ToastHost' && clause?.name) rawHosts.add(clause.name.text)
    if (module === '@/components/safety/ContentSafetyActions' && clause?.name) feedback.add(clause.name.text)
    if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      const name = clause.namedBindings.name.text
      if (module === 'react-native') nativeModals.add(`${name}.Modal`)
      if (/^@\/utils\/toast(?:\.native)?$/.test(module)) {
        feedback.add(`${name}.showToast`)
        feedback.add(`${name}.showToastMessage`)
      }
    }
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      clause.namedBindings.elements.forEach((item) => {
        const imported = (item.propertyName ?? item.name).text
        if (module === 'react-native' && imported === 'Modal') nativeModals.add(item.name.text)
        if (['showToast', 'showToastMessage', 'useActionFeedback', 'useReportContent', 'useContentSafetyActions'].includes(imported)) feedback.add(item.name.text)
      })
    }
  })
  const modals = []
  let usesFeedback = false
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && /^Platform\.OS===['"]web['"]$/.test(normalize(node.initializer.getText()))) webAliases.add(node.name.getText())
    if (ts.isCallExpression(node) && feedback.has(node.expression.getText())) usesFeedback = true
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (feedback.has(jsxName(node)) || hosts.has(jsxName(node)) || rawHosts.has(jsxName(node))) usesFeedback = true
      if (nativeModals.has(jsxName(node))) modals.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { source, modals, bottomSheets, hosts, rawHosts, usesFeedback, webAliases }
}

function isInModalContent(node, modal) {
  for (let parent = node.parent; parent && parent !== modal; parent = parent.parent) {
    if (ts.isJsxAttribute(parent) && parent.parent === opening(modal).attributes && parent.name.getText() === 'modalContent') return true
  }
  return false
}

function isWebBranch(node, webAliases) {
  const isWeb = (condition) => webAliases.has(condition.getText()) || /^Platform\.OS===['"]web['"]$/.test(normalize(condition.getText()))
  let child = node
  for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isConditionalExpression(parent) && child === parent.whenTrue && isWeb(parent.condition)) return true
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && child === parent.right && isWeb(parent.left)) return true
  }
  return false
}

function scanModalFeedback(rootDir) {
  const findings = []
  const entries = [...MODAL_FEEDBACK_ROOTS, ...TRANSIENT_MODALS]
  const files = new Set(entries.map((entry) => entry.file))
  const walk = (rel) => {
    const abs = path.join(rootDir, rel)
    if (!fs.existsSync(abs)) return
    for (const item of fs.readdirSync(abs, { withFileTypes: true })) {
      const file = `${rel}/${item.name}`
      if (item.isDirectory()) walk(file)
      else if (/\.(?:tsx|jsx)$/.test(item.name)) files.add(file)
    }
  }
  ;['app', 'components', 'screens'].forEach(walk)
  for (const file of files) {
    const abs = path.join(rootDir, file)
    if (!fs.existsSync(abs)) { findings.push(`${file}: registered feedback root missing`); continue }
    const text = fs.readFileSync(abs, 'utf8')
    const info = sourceInfo(file, text)
    const expected = entries.filter((entry) => entry.file === file)
    // Metro chooses the native sibling for both iOS/Android; this base module's
    // direct Modal branches serve web only. The native sibling is scanned too.
    const nativeSibling = file.replace(/\.(tsx|jsx)$/, '.native.$1')
    const webOnly = /\.web\.(tsx|jsx)$/.test(file) || (!/\.(native|ios|android)\./.test(file) && fs.existsSync(path.join(rootDir, nativeSibling)))
    const seen = new Set()
    for (const modal of info.modals) {
      if (webOnly || isWebBranch(modal, info.webAliases)) continue
      const visible = attribute(modal, 'visible') ?? 'true'
      const entry = expected.find((item) => normalize(item.visible) === visible)
      if (!entry && info.usesFeedback) { findings.push(`${file}: native Modal visible=${visible} uses feedback outside registry`); continue }
      if (!entry) continue
      seen.add(entry)
      const retainedHosts = []
      const inspect = (node) => {
        if (node !== modal && (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && info.modals.includes(node)) return
        if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
          if (info.hosts.has(jsxName(node))) {
            retainedHosts.push(node)
            if (info.bottomSheets.has(jsxName(modal)) && !isInModalContent(node, modal)) findings.push(`${file}: BottomSheet ModalToastHost must use modalContent outside the panel`)
          }
          if (info.rawHosts.has(jsxName(node))) findings.push(`${file}: native Modal uses raw ToastHost; use ModalToastHost`)
        }
        ts.forEachChild(node, inspect)
      }
      inspect(modal)
      if (entry.policy === 'host') {
        if (retainedHosts.length !== 1 || attribute(retainedHosts[0], 'visible') !== visible) findings.push(`${file}: native Modal visible=${visible} needs one retained ModalToastHost with matching visible`)
      } else {
        if (!entry.reason || retainedHosts.length) findings.push(`${file}: transient feedback must remain with the retained parent, not a temporary host`)
        if (entry.policy === 'report-parent' && !/onSuccess:\s*\(\)\s*=>\s*\{[\s\S]*?close\(\)/.test(text)) findings.push(`${file}: report success no longer closes the transient sheet; re-review feedback policy`)
        if (entry.policy === 'export-parent') {
          for (const handler of ['shareAsPNG', 'shareAsGPX', 'shareAsGeoJSON']) {
            if (!new RegExp(`setExportMenuVisible\\(false\\);\\s*void ${handler}\\(`).test(modal.getText())) findings.push(`${file}: ${handler} must close export menu before feedback`)
          }
        }
        if (entry.policy === 'status-parent') {
          for (const handler of ['handleSelectStatus', 'handleConfirmDate', 'handleRemove']) {
            const declaration = info.source.statements.flatMap((statement) => ts.isFunctionDeclaration(statement) ? statement.body?.statements ?? [] : [])
              .flatMap((statement) => ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [])
              .find((node) => node.name.getText() === handler)
            const body = declaration?.initializer?.getText() ?? ''
            if (!/setModalOpen\(false\)/.test(body) || body.indexOf('setModalOpen(false)') > body.indexOf('await run(')) findings.push(`${file}: ${handler} must close status sheet before feedback`)
          }
        }
      }
    }
    for (const entry of expected) if (!seen.has(entry)) findings.push(`${file}: registered native Modal visible=${entry.visible} missing or changed`)
  }
  return findings
}

if (require.main === module) {
  const findings = scanModalFeedback(path.resolve(__dirname, '..'))
  if (findings.length) {
    console.error(`guard:modal-feedback: ${findings.join('\n')}`)
    process.exit(1)
  }
  console.log('guard:modal-feedback: ok')
}
module.exports = { MODAL_FEEDBACK_ROOTS, TRANSIENT_MODALS, scanModalFeedback }
