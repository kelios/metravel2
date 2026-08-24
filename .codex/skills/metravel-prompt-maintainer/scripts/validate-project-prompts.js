#!/usr/bin/env node
/* global require, __dirname, process */

const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '../../../..')
const skillsRoot = path.join(repoRoot, '.codex', 'skills')
const claudeAgentsRoot = path.join(repoRoot, '.claude', 'agents')
const MAX_CATALOG_DESCRIPTION_LENGTH = 380
const errors = []
let skillCount = 0
let claudeAgentCount = 0
let promptCount = 0

const read = (file) => fs.readFileSync(file, 'utf8')
const relative = (file) => path.relative(repoRoot, file)
const agentsInstructions = read(path.join(repoRoot, 'AGENTS.md'))
const codexGuide = read(path.join(repoRoot, 'docs', 'CODEX.md'))
const codexSkillsGuide = read(path.join(repoRoot, 'docs', 'CODEX_SKILLS.md'))
const agentsRoutesSkillCatalog = agentsInstructions.includes('docs/CODEX_SKILLS.md')
const codexGuideRoutesSkillCatalog = codexGuide.includes('docs/CODEX_SKILLS.md')

const walk = (dir, matcher, output = []) => {
  if (!fs.existsSync(dir)) return output
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(target, matcher, output)
    else if (matcher(target)) output.push(target)
  }
  return output
}

const fail = (file, message) => errors.push(`${relative(file)}: ${message}`)

const yamlScalar = (frontmatter, key) => {
  const lines = frontmatter.split(/\r?\n/)
  const index = lines.findIndex((line) => line.startsWith(`${key}:`))
  if (index < 0) return ''

  const inline = lines[index].slice(key.length + 1).trim()
  if (/^[>|][+-]?$/.test(inline)) {
    const folded = []
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor]
      if (!/^\s+/.test(line)) break
      if (line.trim()) folded.push(line.trim())
    }
    return folded.join(' ')
  }

  const quoted = inline.match(/^(["'])([\s\S]*)\1$/)
  return quoted ? quoted[2] : inline
}

const validateCatalogDescription = (file, frontmatter) => {
  const description = yamlScalar(frontmatter, 'description')
  if (!description) {
    fail(file, 'missing description')
    return
  }
  const length = Array.from(description).length
  if (length > MAX_CATALOG_DESCRIPTION_LENGTH) {
    fail(file, `description must be <=${MAX_CATALOG_DESCRIPTION_LENGTH} characters (found ${length}); keep capability + concrete triggers and move workflow to the body`)
  }
}

if (!codexGuideRoutesSkillCatalog) {
  fail(path.join(repoRoot, 'docs', 'CODEX.md'), 'missing route to docs/CODEX_SKILLS.md')
}

for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const skillName = entry.name
  const skillDir = path.join(skillsRoot, skillName)
  const skillFile = path.join(skillDir, 'SKILL.md')
  const agentFile = path.join(skillDir, 'agents', 'openai.yaml')
  skillCount += 1

  if (!fs.existsSync(skillFile)) {
    fail(skillDir, 'missing SKILL.md')
    continue
  }
  if (!fs.existsSync(agentFile)) {
    fail(skillDir, 'missing agents/openai.yaml')
    continue
  }

  const routedFromAgents = agentsInstructions.includes(`$${skillName}`)
    || (agentsRoutesSkillCatalog && codexSkillsGuide.includes(`$${skillName}`))
  if (!routedFromAgents) {
    fail(skillFile, 'skill is not routed from AGENTS.md or its docs/CODEX_SKILLS.md catalog')
  }
  const skill = read(skillFile)
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!frontmatter) {
    fail(skillFile, 'missing YAML frontmatter')
  } else {
    const name = frontmatter[1].match(/^name:\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1]
    if (name !== skillName) fail(skillFile, `frontmatter name must match folder (${skillName})`)
    validateCatalogDescription(skillFile, frontmatter[1])
  }
  if (/\[(?:TODO|FIXME|TBD)\b|\b(?:TODO|FIXME|TBD):|Complete and informative explanation/i.test(skill)) {
    fail(skillFile, 'contains unfinished scaffolding')
  }

  const agent = read(agentFile)
  const shortDescription = agent.match(/^\s*short_description:\s*"([^"]+)"\s*$/m)?.[1]
  const defaultPrompt = agent.match(/^\s*default_prompt:\s*"([^"]+)"\s*$/m)?.[1]
  if (!shortDescription) {
    fail(agentFile, 'missing quoted short_description')
  } else if (shortDescription.length < 25 || shortDescription.length > 64) {
    fail(agentFile, `short_description must be 25-64 characters (found ${shortDescription.length})`)
  }
  if (!defaultPrompt) {
    fail(agentFile, 'missing quoted default_prompt')
  } else if (!defaultPrompt.startsWith(`Use $${skillName}`)) {
    fail(agentFile, `default_prompt must start with Use $${skillName}`)
  }
}

for (const file of walk(claudeAgentsRoot, (target) => /\.md$/i.test(target))) {
  claudeAgentCount += 1
  const agent = read(file)
  const frontmatter = agent.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!frontmatter) {
    fail(file, 'missing YAML frontmatter')
    continue
  }
  validateCatalogDescription(file, frontmatter[1])
}

const promptFiles = [
  ...walk(path.join(repoRoot, 'docs'), (file) => /PROMPTS\.md$/i.test(file)),
  ...walk(path.join(repoRoot, 'assets'), (file) => path.basename(file).toUpperCase() === 'PROMPT.MD'),
]

for (const file of promptFiles) {
  promptCount += 1
  const prompt = read(file)
  if (/\[(?:TODO|FIXME|TBD)\b|\b(?:TODO|FIXME|TBD):|Complete and informative explanation/i.test(prompt)) {
    fail(file, 'contains unfinished prompt scaffolding')
  }
  if (/CLAUDE\.md|\.claude\/skills/i.test(prompt)) {
    fail(file, 'references a model-specific legacy instruction instead of a canonical project source')
  }
  if (path.basename(file).toUpperCase() === 'PROMPT.MD') {
    const linksCanonicalSpec = /docs\/[^\s`]*PROMPTS\.md/i.test(prompt)
    const hasSelfContainedContract = /Use case:/i.test(prompt) && /Asset type:/i.test(prompt) && /Constraints:/i.test(prompt)
    if (!linksCanonicalSpec && !hasSelfContainedContract) {
      fail(file, 'missing canonical docs/*PROMPTS.md reference or self-contained prompt contract')
    }
    if (!/```[\s\S]+```/.test(prompt)) fail(file, 'missing fenced exact prompt')
  }
}

if (errors.length > 0) {
  console.error(`prompt-audit: failed with ${errors.length} issue(s)`)
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.info(`prompt-audit: passed (${skillCount} skills, ${claudeAgentCount} Claude agents, ${promptCount} prompt artifacts)`)
}
