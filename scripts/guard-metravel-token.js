#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const CACHE = /(?:\.?metravel_(?:editor_)?token(?:\.qa104|\.profiles\.json)?|metravel-token\.json|mcp_token\.json)(?![-\w])/
const KERNEL = new Set(['scripts/lib/metravel-token.js', 'scripts/lib/metravel-token-cache.js'])
const ACTIVE_GUIDANCE = [
  '.agents/skills/metravel-quest/SKILL.md', '.claude/skills/metravel-quest/SKILL.md',
  '.agents/skills/metravel-quest-finale/SKILL.md', '.claude/skills/metravel-quest-finale/SKILL.md',
  '.agents/skills/metravel-quest-geocheck/SKILL.md', '.claude/skills/metravel-quest-geocheck/SKILL.md',
  '.agents/skills/metravel-travel-article/SKILL.md', '.claude/skills/metravel-travel-article/SKILL.md',
  '.claude/agents/quest-editor.md', '.claude/agents/quest-friction-analyst.md',
  '.claude/agents/travel-writer.md', '.claude/agents/seo-daily.md', '.codex/agents/quest-editor.toml',
  '.codex/skills/metravel-article-editor-agent/SKILL.md',
  'scripts/INSTAGRAM_SETUP.md', 'docs/QUEST_TRANSLATION_GUIDE.md',
]

function inspectJavaScript(text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const values = new Map(), reads = new Set(['readFile', 'readFileSync', 'readRegular', 'open', 'openSync', 'loadToken', 'readToken'])
  function value(node, depth = 0) {
    if (!node || depth > 16) return ''
    if (ts.isStringLiteralLike(node)) return node.text
    if (ts.isIdentifier(node)) return values.get(node.text) || ''
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) return value(node.left, depth + 1) + value(node.right, depth + 1)
    if (ts.isCallExpression(node)) return node.arguments.map((arg) => value(arg, depth + 1)).join('/')
    if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((span) => value(span.expression, depth + 1) + span.literal.text).join('')
    return ''
  }
  const walk = (node, visit) => { visit(node); ts.forEachChild(node, (child) => walk(child, visit)) }
  // Propagate joined/aliased filenames and imported fs function aliases.
  for (let pass = 0; pass < 8; pass++) walk(source, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      values.set(node.name.text, value(node.initializer))
      if (node.initializer && reads.has(node.initializer.getText(source).split('.').pop())) reads.add(node.name.text)
    }
    if (ts.isImportSpecifier(node) && reads.has((node.propertyName || node.name).text)) reads.add(node.name.text)
    if (ts.isBindingElement(node) && reads.has((node.propertyName || node.name).getText(source))) reads.add(node.name.getText(source))
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      walk(node.body, (child) => {
        if (ts.isCallExpression(child) && reads.has(child.expression.getText(source).split('.').pop())) reads.add(node.name.text)
      })
    }
  })
  const findings = []
  walk(source, (node) => {
    if (!ts.isCallExpression(node)) return
    const callee = node.expression.getText(source), name = callee.split('.').pop()
    const args = node.arguments.map((arg) => value(arg))
    const tokenPath = args.some((arg) => CACHE.test(arg))
    const reader = reads.has(name) || /(?:readFile|readToken|loadToken|open)(?:Sync)?$/.test(name)
    const capturesIssuer = /(?:exec|spawn)/.test(name) && node.arguments.some((arg) => /get-quest-token\.js/.test(arg.getText(source)))
    const credentialArgv = /(?:exec|spawn)/.test(name) && node.arguments.some((arg) => /Authorization\s*[:=]/i.test(arg.getText(source)))
    if ((tokenPath && reader) || capturesIssuer || credentialArgv) {
      findings.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, reason: capturesIssuer ? 'token issuer stdout capture' : credentialArgv ? 'credential argv' : 'direct token-cache reader' })
    }
  })
  return findings
}

function inspectSource(text, file) {
  if (KERNEL.has(file)) return []
  if (file.endsWith('.py')) {
    // Remove prose/comments; remaining executable cache literals are forbidden.
    const code = text.replace(/(["'])\1\1[\s\S]*?\1\1\1/g, '').replace(/#[^\n]*/g, '')
    return code.split('\n').flatMap((line, index) => CACHE.test(line) ? [{ file, line: index + 1, reason: 'Python token-cache reader' }] : [])
  }
  if (/\.(?:md|toml)$/.test(file)) return text.split('\n').flatMap((line, index) =>
    /\$\([^)]*(?:get-quest-token|cat[^)]*(?:metravel_token|mcp_token))|Authorization[^\n]*(?:\$(?:METRAVEL_|EDITORIAL_)?TOKEN|\$\([^)]*token)/.test(line)
      ? [{ file, line: index + 1, reason: 'documented token stdout/argv capture' }] : [])
  return inspectJavaScript(text, file)
}

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? filesIn(file) : /\.(?:js|cjs|mjs)$/.test(file) ? [file] : []
  })
}

function main() {
  const files = [...filesIn('scripts'), ...ACTIVE_GUIDANCE, '.agents/skills/metravel-travel-article/scripts/metravel_publish.py', '.claude/skills/metravel-travel-article/scripts/metravel_publish.py']
  const findings = files.flatMap((file) => inspectSource(fs.readFileSync(file, 'utf8'), file))
  for (const finding of findings) console.error(`${finding.file}:${finding.line}: ${finding.reason}`)
  if (findings.length) process.exitCode = 1
  else console.log('MeTravel token governance: no direct readers or issuer captures')
}
if (require.main === module) main()
module.exports = { inspectSource, main }
