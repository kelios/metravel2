/* global require, module */

const fs = require('fs')
const path = require('path')

const MAX_CATALOG_DESCRIPTION_LENGTH = 380
// Generated upstream for different clients; project rules do not rewrite these variants.
const OPENSPEC_VENDOR_SKILLS = new Set([
  'openspec-apply-change',
  'openspec-archive-change',
  'openspec-explore',
  'openspec-propose',
  'openspec-sync-specs',
  'openspec-update-change',
])
// spec-kit regenerates `.github/skills/speckit-*` and tracks their hashes in
// `.specify/integrations/copilot.manifest.json`; the project budget is not theirs to satisfy.
const isVendorSkill = (name) => OPENSPEC_VENDOR_SKILLS.has(name) || name.startsWith('speckit-')

const yamlScalar = (frontmatter, key) => {
  const lines = frontmatter.split(/\r?\n/)
  const index = lines.findIndex((line) => line.startsWith(`${key}:`))
  if (index < 0) return ''

  const inline = lines[index].slice(key.length + 1).trim()
  if (/^[>|][+-]?$/.test(inline)) {
    const folded = []
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor]
      if (!line.trim()) continue
      if (!/^\s+/.test(line)) break
      folded.push(line.trim())
    }
    return folded.join(' ')
  }

  const quoted = inline.match(/^(["'])([\s\S]*)\1$/)
  if (!quoted && /^(?:null|~|#.*)$/i.test(inline)) return ''
  return (quoted ? quoted[2] : inline).trim()
}

const descriptionErrors = (frontmatter, enforceBudget = true) => {
  const description = yamlScalar(frontmatter, 'description')
  if (!description) return ['missing description']
  const length = Array.from(description).length
  if (enforceBudget && length > MAX_CATALOG_DESCRIPTION_LENGTH) {
    return [`description must be <=${MAX_CATALOG_DESCRIPTION_LENGTH} characters (found ${length}); keep capability + concrete triggers and move workflow to the body`]
  }
  return []
}

const skillMetadataErrors = (skill, skillName, enforceBudget = true) => {
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!frontmatter) return ['missing YAML frontmatter']
  const errors = []
  if (yamlScalar(frontmatter[1], 'name') !== skillName) {
    errors.push(`frontmatter name must match folder (${skillName})`)
  }
  return errors.concat(descriptionErrors(frontmatter[1], enforceBudget))
}

// `canonicalLabel` — как назвать источник в тексте ошибки. #1823 добавил второе
// зеркало (`.github/skills` против `.codex/skills`), поэтому источник больше не
// один и зашитая в сообщение строка врала бы про половину находок.
const auditSkillFamily = (root, canonicalRoot, canonicalLabel = '.agents/skills') => {
  const result = { count: 0, vendorCount: 0, mirrorCount: 0, errors: [] }
  if (!fs.existsSync(root)) {
    result.errors.push({ file: root, message: 'missing skill directory' })
    return result
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    result.count += 1
    const vendor = isVendorSkill(entry.name)
    if (vendor) result.vendorCount += 1
    const file = path.join(root, entry.name, 'SKILL.md')
    if (!fs.existsSync(file)) {
      result.errors.push({ file, message: 'missing SKILL.md' })
      continue
    }
    const skill = fs.readFileSync(file, 'utf8')
    for (const message of skillMetadataErrors(skill, entry.name, !vendor)) {
      result.errors.push({ file, message })
    }
    if (!canonicalRoot || vendor) continue
    const canonicalFile = path.join(canonicalRoot, entry.name, 'SKILL.md')
    if (!fs.existsSync(canonicalFile)) continue
    result.mirrorCount += 1
    if (skill !== fs.readFileSync(canonicalFile, 'utf8')) {
      result.errors.push({ file, message: `SKILL.md differs from canonical ${canonicalLabel}/${entry.name}/SKILL.md` })
    }
  }
  return result
}

// Agent metadata is deliberately restricted to one-line quoted TOML scalars.
// Only inspect the header: example snippets in developer_instructions are not metadata.
const tomlAgentHeader = (source) => source.split(/^developer_instructions\s*=/m)[0]
const tomlHeaderScalar = (header, key) => {
  const raw = header.match(new RegExp(`^${key}\\s*=\\s*(.+?)\\s*$`, 'm'))?.[1]
  if (!raw) return ''
  if (/^'[^'\r\n]*'$/.test(raw)) return raw.slice(1, -1)
  try {
    const value = JSON.parse(raw)
    return typeof value === 'string' ? value : ''
  } catch { return '' }
}

const codexAgentMetadataErrors = (source, expectedName) => {
  const header = tomlAgentHeader(source)
  const errors = []
  if (tomlHeaderScalar(header, 'name') !== expectedName) {
    errors.push(`adapter name must match filename (${expectedName})`)
  }
  const description = tomlHeaderScalar(header, 'description').trim()
  if (!description) errors.push('missing quoted adapter description')
  else if (Array.from(description).length > MAX_CATALOG_DESCRIPTION_LENGTH) {
    errors.push(`description must be <=${MAX_CATALOG_DESCRIPTION_LENGTH} characters (found ${Array.from(description).length}); keep capability + concrete triggers and move workflow to the body`)
  }
  const instructions = source.match(/^developer_instructions\s*=\s*(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')/m)
  if (!instructions) {
    errors.push('missing multiline developer_instructions')
  } else if (!(instructions[1] || instructions[2] || '').includes(`.claude/agents/${expectedName}.md`)) {
    errors.push(`developer_instructions must delegate canonical .claude/agents/${expectedName}.md`)
  }
  return errors
}

const auditCodexAgentFamily = (root, repoRoot) => {
  const result = { count: 0, errors: [] }
  if (!fs.existsSync(root)) {
    result.errors.push({ file: root, message: 'missing Codex agent directory' })
    return result
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.toml')) continue
    result.count += 1
    const name = entry.name.slice(0, -5)
    const file = path.join(root, entry.name)
    const source = fs.readFileSync(file, 'utf8')
    for (const message of codexAgentMetadataErrors(source, name)) result.errors.push({ file, message })
    const canonicalRole = `.claude/agents/${name}.md`
    if (!fs.existsSync(path.join(repoRoot, canonicalRole))) {
      result.errors.push({ file, message: `missing canonical role ${canonicalRole}` })
    }
    // Required same-role delegation prevents independent policy copies; target existence
    // still cannot prove the semantic correctness of the canonical role itself.
    const references = new Set(source.match(/\.(?:claude\/agents\/[\w-]+\.md|codex\/skills\/[\w-]+\/SKILL\.md)/g) || [])
    for (const reference of references) {
      if (!fs.existsSync(path.join(repoRoot, reference))) {
        result.errors.push({ file, message: `missing canonical instruction ${reference}` })
      }
    }
  }
  return result
}

module.exports = { auditSkillFamily, descriptionErrors, skillMetadataErrors, codexAgentMetadataErrors, auditCodexAgentFamily }
