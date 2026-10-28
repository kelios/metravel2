/* global require, module */

const fs = require('node:fs')
const path = require('node:path')

const SELECTION_GATE = 'Validation selection gate'
const SELECTION_DOCUMENT = 'docs/TESTING.md'
const NATIVE_RUNBOOK = 'Native scenario automation and recording readiness'
// Only active canonical entrypoints belong here. Mirrors are checked separately;
// historical task/spec artifacts are evidence, not instructions to execute.
const SELECTION_CONSUMERS = [
  '.codex/skills/metravel-feature-builder/SKILL.md',
  '.codex/skills/metravel-task-contract/SKILL.md',
  '.codex/skills/metravel-codex-orchestrator/SKILL.md',
  '.codex/skills/metravel-ios-tester/SKILL.md',
  '.codex/skills/metravel-mobile-tester/SKILL.md',
  '.codex/skills/metravel-browser-reviewer/SKILL.md',
  '.claude/skills/review-uiux/SKILL.md',
  '.claude/skills/android-qa-sweep/SKILL.md',
  '.claude/skills/ios-qa-sweep/SKILL.md',
  '.claude/agents/task-author.md',
  '.claude/agents/ticket-board.md',
  '.claude/agents/dev-loop.md',
  '.claude/agents/board-reviewer.md',
  '.claude/agents/ios-tester.md',
]
const DELEGATING_ADAPTERS = [
  '.codex/agents/test-author.toml',
  '.codex/agents/ios-tester.toml',
]
const ACTIVE_CONTEXT = 'openspec/config.yaml'
const consumerSet = new Set(SELECTION_CONSUMERS)
const adapterSet = new Set(DELEGATING_ADAPTERS)

// These match the confirmed regressions, not arbitrary natural-language intent.
// A passing structural audit does not prove a model's choice on an unseen diff.
const validationSelectionErrors = (source, file) => {
  const errors = []
  const relative = file.replace(/\\/g, '/')
  const text = source.replace(/\s+/g, ' ')
  if (relative === SELECTION_DOCUMENT) {
    if (!/^#{2,6}\s+Validation selection gate\s*$/m.test(source)) {
      errors.push(`missing canonical ${SELECTION_GATE} heading`)
    }
  }
  if (consumerSet.has(relative)) {
    if (!source.includes(SELECTION_DOCUMENT) || !source.includes(SELECTION_GATE)) {
      errors.push(`must reference ${SELECTION_DOCUMENT} → ${SELECTION_GATE} before target prerequisites`)
    }
    const nativeRunbook = source.indexOf(NATIVE_RUNBOOK)
    if (nativeRunbook >= 0 && source.indexOf(SELECTION_GATE) > nativeRunbook) {
      errors.push('selection gate must precede the native runbook, not follow readiness work')
    }
    if (/обязательных проверок на каждой заявленной поверхности/iu.test(text)) {
      errors.push('blanket checks on every declared surface contradict validation selection')
    }
    if (/каждый проверяемый экран сравнивай[^.]*native/iu.test(text)) {
      errors.push('blanket web-to-native comparison contradicts validation selection')
    }
    if (/исчерпай альтернативный путь[^.]*device-verify/iu.test(text)) {
      errors.push('web fallback must not add device-verify outside selected targets')
    }
    if (/после правки общего файла обязательна web-проверка/iu.test(text)) {
      errors.push('shared file ownership must not automatically add a web runtime check')
    }
  }
  if (adapterSet.has(relative) && text.includes(NATIVE_RUNBOOK)) {
    errors.push('adapter must delegate its canonical role without forcing a native runbook')
  }
  if (relative === ACTIVE_CONTEXT && /mobile web and Android remain paired controls/i.test(text)) {
    errors.push('OpenSpec context must not force paired mobile-web/Android validation')
  }
  return errors
}

const auditValidationSelectionPolicy = (repoRoot) => {
  const files = [SELECTION_DOCUMENT, ...SELECTION_CONSUMERS, ...DELEGATING_ADAPTERS, ACTIVE_CONTEXT]
  const result = { count: files.length, errors: [] }
  for (const relative of files) {
    const file = path.join(repoRoot, relative)
    if (!fs.existsSync(file)) {
      result.errors.push({ file, message: 'missing canonical validation-selection instruction' })
      continue
    }
    for (const message of validationSelectionErrors(fs.readFileSync(file, 'utf8'), relative)) {
      result.errors.push({ file, message })
    }
  }
  return result
}

module.exports = {
  SELECTION_GATE,
  SELECTION_DOCUMENT,
  SELECTION_CONSUMERS,
  DELEGATING_ADAPTERS,
  ACTIVE_CONTEXT,
  validationSelectionErrors,
  auditValidationSelectionPolicy,
}
