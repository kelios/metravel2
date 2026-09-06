const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const { auditSkillFamily, skillMetadataErrors } = require('./skill-catalog-validation')

const skill = (name, description = 'Review project prompts.', body = 'Instructions.') =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`

const fixture = (t) => {
  const tempRoot = path.resolve(__dirname, '../../../../.codex-temp')
  fs.mkdirSync(tempRoot, { recursive: true })
  const root = fs.mkdtempSync(path.join(tempRoot, 'prompt-audit-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const shared = path.join(root, '.agents/skills')
  const claude = path.join(root, '.claude/skills')
  fs.mkdirSync(shared, { recursive: true })
  fs.mkdirSync(claude, { recursive: true })
  const write = (family, name, content) => {
    const dir = path.join(family, name)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'SKILL.md'), content)
  }
  return { shared, claude, write }
}

test('rejects a skill name that does not match its directory', () => {
  assert.deepEqual(skillMetadataErrors(skill('wrong-name'), 'expected-name'), [
    'frontmatter name must match folder (expected-name)',
  ])
  assert.deepEqual(skillMetadataErrors(skill('"expected-name"'), 'expected-name'), [])
})

test('rejects absent or empty descriptions, including folded and YAML null values', () => {
  for (const description of ['', '""', "'   '", '|', '>', 'null', '~', '# omitted']) {
    assert.deepEqual(skillMetadataErrors(skill('example', description), 'example'), ['missing description'])
  }
  assert.deepEqual(skillMetadataErrors('---\nname: example\n---\n', 'example'), ['missing description'])
  assert.deepEqual(skillMetadataErrors('name: example\n', 'example'), ['missing YAML frontmatter'])
})

test('counts folded Unicode descriptions and enforces the project budget', () => {
  assert.deepEqual(skillMetadataErrors(skill('example', `>\n  ${'я'.repeat(379)}`), 'example'), [])
  assert.equal(skillMetadataErrors(skill('example', '🧭'.repeat(381)), 'example').length, 1)
  assert.equal(skillMetadataErrors(skill('example', `>\n  ${'a'.repeat(190)}\n\n  ${'b'.repeat(190)}`), 'example').length, 1)
})

test('audits both skill families and reports drift only for existing mirrors', (t) => {
  const { shared, claude, write } = fixture(t)
  write(shared, 'matched', skill('matched'))
  write(claude, 'matched', skill('matched'))
  write(shared, 'changed', skill('changed'))
  write(claude, 'changed', skill('changed', undefined, 'Outdated instructions.'))
  write(shared, 'shared-only', skill('shared-only'))
  write(claude, 'claude-only', skill('claude-only'))
  assert.deepEqual(auditSkillFamily(shared), { count: 3, vendorCount: 0, mirrorCount: 0, errors: [] })
  const result = auditSkillFamily(claude, shared)
  assert.equal(result.count, 3)
  assert.equal(result.mirrorCount, 2)
  assert.deepEqual(result.errors, [{
    file: path.join(claude, 'changed/SKILL.md'),
    message: 'SKILL.md differs from canonical .agents/skills/changed/SKILL.md',
  }])
})

test('OpenSpec vendor variants skip drift and budget but retain required metadata checks', (t) => {
  const { shared, claude, write } = fixture(t)
  write(shared, 'openspec-propose', skill('openspec-propose', 'x'.repeat(500)))
  write(claude, 'openspec-propose', skill('openspec-propose', 'y'.repeat(500), 'Client variant.'))
  assert.deepEqual(auditSkillFamily(claude, shared), { count: 1, vendorCount: 1, mirrorCount: 0, errors: [] })
  write(claude, 'openspec-propose', skill('wrong-name', ''))
  assert.equal(auditSkillFamily(claude, shared).errors.length, 2)
  write(claude, 'openspec-project-custom', skill('openspec-project-custom', 'z'.repeat(500)))
  assert.match(auditSkillFamily(claude, shared).errors[0].message, /description must be <=380/)
})

test('spec-kit vendor skills skip the budget while project .github skills keep it', (t) => {
  const { claude, write } = fixture(t)
  write(claude, 'speckit-plan', skill('speckit-plan', 'x'.repeat(500)))
  assert.deepEqual(auditSkillFamily(claude), { count: 1, vendorCount: 1, mirrorCount: 0, errors: [] })
  write(claude, 'speckit-plan', skill('renamed-by-hand'))
  assert.deepEqual(auditSkillFamily(claude).errors.map((error) => error.message), [
    'frontmatter name must match folder (speckit-plan)',
  ])
  write(claude, 'metravel-feature-builder', skill('metravel-feature-builder', 'z'.repeat(500)))
  const messages = auditSkillFamily(claude).errors.map((error) => error.message)
  assert.equal(messages.length, 2)
  assert.ok(messages.some((message) => /description must be <=380/.test(message)))
})

test('missing family directories or SKILL.md are actionable failures', (t) => {
  const { shared } = fixture(t)
  assert.match(auditSkillFamily(path.join(shared, 'absent')).errors[0].message, /missing skill directory/)
  fs.mkdirSync(path.join(shared, 'empty-skill'))
  assert.deepEqual(auditSkillFamily(shared).errors, [{
    file: path.join(shared, 'empty-skill/SKILL.md'), message: 'missing SKILL.md',
  }])
})
