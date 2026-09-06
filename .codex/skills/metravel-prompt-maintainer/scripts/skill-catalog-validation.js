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

const auditSkillFamily = (root, canonicalRoot) => {
  const result = { count: 0, vendorCount: 0, mirrorCount: 0, errors: [] }
  if (!fs.existsSync(root)) {
    result.errors.push({ file: root, message: 'missing skill directory' })
    return result
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    result.count += 1
    const vendor = OPENSPEC_VENDOR_SKILLS.has(entry.name)
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
      result.errors.push({ file, message: `SKILL.md differs from canonical .agents/skills/${entry.name}/SKILL.md` })
    }
  }
  return result
}

module.exports = { auditSkillFamily, descriptionErrors, skillMetadataErrors }
