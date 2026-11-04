const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const { auditContentPrompts } = require('./audit-content-prompts')

test('Git audit and local audit cover disjoint prompt sets', (t) => {
  // This test process owns one fixture. A parent Git hook may set repository
  // variables that would otherwise redirect fixture commands to its checkout.
  const gitEnv = Object.entries(process.env).filter(([key]) => key.startsWith('GIT_'))
  for (const [key] of gitEnv) delete process.env[key]
  t.after(() => {
    for (const [key, value] of gitEnv) process.env[key] = value
  })

  const scratch = path.resolve(__dirname, '../../../../.codex-temp')
  fs.mkdirSync(scratch, { recursive: true })
  const root = fs.mkdtempSync(path.join(scratch, 'content-prompts-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' })
  git('init', '-q')
  fs.mkdirSync(path.join(root, 'assets/ignored quest'), { recursive: true })
  fs.mkdirSync(path.join(root, 'docs'))
  fs.writeFileSync(path.join(root, '.gitignore'), '/assets/\n')
  const tracked = path.join(root, 'docs/ICON_PROMPTS.md')
  fs.writeFileSync(tracked, 'Prompt spec\n')
  git('add', 'docs/ICON_PROMPTS.md')
  fs.writeFileSync(path.join(root, 'docs/NEW_PROMPTS.md'), 'Untracked spec\n')
  fs.writeFileSync(path.join(root, 'assets/ignored quest/PROMPT.md'), 'TODO: local draft\n')

  assert.deepEqual(auditContentPrompts(root), { count: 1, errors: [] })
  const local = auditContentPrompts(root, true)
  assert.equal(local.count, 2)
  assert.equal(local.errors.length, 3)
  assert.ok(local.errors.every(error => error.startsWith('assets/ignored quest/PROMPT.md:')))

  fs.writeFileSync(tracked, 'TODO: working copy\n')
  assert.match(auditContentPrompts(root).errors[0], /^docs\/ICON_PROMPTS.md: contains unfinished/)
  fs.rmSync(tracked)
  assert.match(auditContentPrompts(root).errors[0], /^docs\/ICON_PROMPTS.md: expected a regular/)
})
