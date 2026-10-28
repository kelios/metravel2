const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const {
  SELECTION_GATE,
  SELECTION_DOCUMENT,
  SELECTION_CONSUMERS,
  DELEGATING_ADAPTERS,
  ACTIVE_CONTEXT,
  auditValidationSelectionPolicy,
} = require('./validation-selection-policy')

const repoRoot = path.resolve(__dirname, '../../../..')
const fixture = (t) => {
  const tempRoot = path.join(repoRoot, '.codex-temp')
  fs.mkdirSync(tempRoot, { recursive: true })
  const root = fs.mkdtempSync(path.join(tempRoot, 'validation-selection-policy-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const files = [SELECTION_DOCUMENT, ...SELECTION_CONSUMERS, ...DELEGATING_ADAPTERS, ACTIVE_CONTEXT]
  // Copy real active instructions so mutations exercise the shipped policy,
  // rather than a second toy contract that merely agrees with the checker.
  for (const relative of files) {
    const target = path.join(root, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(repoRoot, relative), target)
  }
  const mutate = (relative, change) => {
    const target = path.join(root, relative)
    fs.writeFileSync(target, change(fs.readFileSync(target, 'utf8')))
  }
  return { root, mutate, audit: () => auditValidationSelectionPolicy(root) }
}

test('active canonical validation-selection instructions pass', (t) => {
  assert.deepEqual(fixture(t).audit().errors, [])
})

test('lost canonical gate heading is actionable', (t) => {
  const f = fixture(t)
  f.mutate(SELECTION_DOCUMENT, text => text.replace(/^#{2,6}\s+Validation selection gate\s*$/m, '### Other heading'))
  assert.deepEqual(f.audit().errors.map(error => error.message), [
    `missing canonical ${SELECTION_GATE} heading`,
  ])
})

for (const file of SELECTION_CONSUMERS) {
  test(`lost selection reference fails for ${file}`, (t) => {
    const f = fixture(t)
    f.mutate(file, text => text.replaceAll(SELECTION_GATE, 'legacy matrix'))
    const errors = f.audit().errors
    assert.equal(errors.length, 1)
    assert.equal(errors[0].file, path.join(f.root, file))
    assert.match(errors[0].message, /must reference docs\/TESTING\.md/)
  })
}

test('old producer requirement for every declared platform fails despite a valid gate link', (t) => {
  const f = fixture(t)
  f.mutate('.claude/agents/task-author.md', text => `${text}\n5. Platform impact: с перечнем обязательных\nпроверок на каждой заявленной поверхности.\n`)
  assert.match(f.audit().errors[0].message, /blanket checks on every declared surface/)
})

test('moving an existing selection link after the native procedure still fails', (t) => {
  const f = fixture(t)
  f.mutate('.codex/skills/metravel-ios-tester/SKILL.md', text => `${text.replaceAll(SELECTION_GATE, 'selection removed')}\nUse docs/TESTING.md → ${SELECTION_GATE}.\n`)
  assert.match(f.audit().errors[0].message, /selection gate must precede the native runbook/)
})

test('old mandatory native comparison for every web screen fails', (t) => {
  const f = fixture(t)
  f.mutate('.claude/skills/review-uiux/SKILL.md', text => `${text}\nКаждый проверяемый экран\nсравнивай не только 390px vs 1280px, но и mobile web vs native-приложение. Скрины обеих платформ — в отчёт.\n`)
  assert.match(f.audit().errors[0].message, /blanket web-to-native comparison/)
})

test('old dev-SSR fallback cannot silently turn a web task into device QA', (t) => {
  const f = fixture(t)
  f.mutate('.claude/skills/review-uiux/SKILL.md', text => `${text}\nЕсли dev-SSR крашит — исчерпай альтернативный путь до блокера: локальная prod-сборка, Playwright/e2e,\ndevice-verify.\n`)
  assert.match(f.audit().errors[0].message, /web fallback must not add device-verify/)
})

test('native-only changes in a shared file do not automatically add web runtime', (t) => {
  const f = fixture(t)
  f.mutate('.claude/skills/ios-qa-sweep/SKILL.md', text => `${text}\nПосле правки общего файла\nобязательна web-проверка.\n`)
  assert.match(f.audit().errors[0].message, /shared file ownership must not automatically add a web runtime check/)
})

for (const file of DELEGATING_ADAPTERS) {
  test(`premature native runbook cannot return to ${file}`, (t) => {
    const f = fixture(t)
    f.mutate(file, text => text.replace(/("""|''')\s*$/, '\nСначала загрузи Native scenario automation and recording readiness.\n$1\n'))
    assert.match(f.audit().errors[0].message, /without forcing a native runbook/)
  })
}

test('OpenSpec context cannot force mobile-web/Android as a pair', (t) => {
  const f = fixture(t)
  f.mutate(ACTIVE_CONTEXT, text => text.replace(/context:\s*\|\s*\n/, 'context: |\n  mobile web and Android remain\n  paired controls.\n'))
  assert.match(f.audit().errors[0].message, /OpenSpec context must not force paired/)
})

test('web, shared, docs-only, native-specific and explicit release scopes remain expressible', (t) => {
  const f = fixture(t)
  const cases = [
    'Only a .web component changed; verify its mobile/desktop geometry, leave the separate native sibling unchanged.',
    'Shared route logic uses a regression and one representative web flow; stale native binaries do not add a target.',
    'Docs/prompts-only work uses structural audit and skill validators, with focused unit coverage for a changed guard.',
    'A changed iOS capability selects its simulator or physical layer before stamp and any necessary build.',
    'The current user explicitly requested an Android/iPhone release matrix; retain every required native/capability gate.',
    'Compatible passing evidence is reused after an unrelated file change; rerun only an invalidated assertion.',
  ]
  f.mutate('.codex/skills/metravel-feature-builder/SKILL.md', text => `${text}\n${cases.join('\n')}\n`)
  assert.deepEqual(f.audit().errors, [])
})

test('historical OpenSpec artifacts are evidence rather than executable instruction inputs', (t) => {
  const f = fixture(t)
  const archive = path.join(f.root, 'openspec/changes/archive/old-incident/design.md')
  fs.mkdirSync(path.dirname(archive), { recursive: true })
  fs.writeFileSync(archive, 'mobile web and Android remain paired controls; обязательных проверок на каждой заявленной поверхности')
  assert.deepEqual(f.audit().errors, [])
})

test('a missing canonical consumer is a failure rather than an omitted check', (t) => {
  const f = fixture(t)
  fs.unlinkSync(path.join(f.root, SELECTION_CONSUMERS[0]))
  assert.match(f.audit().errors[0].message, /missing canonical validation-selection instruction/)
})
