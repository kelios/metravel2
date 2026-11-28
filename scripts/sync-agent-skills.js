#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { toPosix, topSegment, collectFiles, sameMirrorFile, applyMirrorPlan, parseMirrorArgs } = require('./lib/skillMirror')

// #1770: один и тот же скилл лежал в репозитории двумя рукописными копиями —
// `.claude/skills/<имя>/` для Claude Code и `.agents/skills/<имя>/` для Codex
// (маркер `.agents/skills/.openspec-target` = `codex`) и Grok
// (`docs/GROK.md` объявляет оба каталога живыми входами). Синхронизировал их
// только человек, поэтому замер 04.09.2026 нашёл 32 расходящиеся пары из 32 и
// ноль совпадающих, а у трёх скиллов `.agents`-копия отставала на поколение:
// правило «FAQ пишется только <details>/<summary>» из #1765 в ней отсутствовало
// целиком. Задача, выполненная Codex по такой копии, выходит без контракта,
// который в проекте уже записан.
//
// Здесь `.claude/skills/**` объявлен единственным источником правды, а
// `.agents/skills/**` — производным зеркалом: побайтовой копией каталога скилла,
// без текстовых подстановок. Подстановки означали бы список исключений на каждый
// файл, то есть тот же рассинхрон другим способом.

const OUTPUT_CONTRACT_VERSION = 1

const SOURCE_SKILLS_DIR = path.join('.claude', 'skills')
const SOURCE_COMMANDS_DIR = path.join('.claude', 'commands')
const TARGET_SKILLS_DIR = path.join('.agents', 'skills')

// Vendor-owned: тела `openspec-*` генерирует сам `openspec init`, отдельно для
// каждого харнесса (`--tools codex` пишет в `.agents/skills`, `--tools claude` —
// в `.claude/skills`), и `docs/spec-driven-development.md` §5 запрещает править
// их руками. Копии расходятся ровно на вендорную разницу: Codex не поддерживает
// поле frontmatter `compatibility` и печатает вызов как `$name (Codex)`. Зеркало
// побайтовой копией сломало бы Codex-копию, поэтому эти каталоги не трогаем —
// их синхронизирует повторный `openspec init`.
const VENDOR_OWNED_SKILLS = ['openspec-']

// `source-command-*` — обёртки слэш-команд для харнессов без `.claude/commands`.
// Список явный, а не «все команды»: сюда входят только команды, состоящие из
// `npm run`/git/bash-шагов. `db-backup` такой и есть: тело — `npm run db:backup:prod`
// и `scripts/backup-prod-db.sh`, без вызова Claude-агента. Остальные семь
// (`ticket`, `seo-daily`, `review-gate`, `task-new`, `growth-review`, `bugfix`,
// `split-component`) ведут работу через Claude-агентов и Claude-MCP, которых на
// другом харнессе нет, — обёртка предлагала бы workflow, который там не выполняется.
const MIRRORED_COMMANDS = ['auto-dev', 'changed-summary', 'check-fast', 'db-backup', 'guard-all', 'preflight']

const COMMAND_SKILL_PREFIX = 'source-command-'

const isVendorOwned = (skillName) => VENDOR_OWNED_SKILLS.some((prefix) => skillName.startsWith(prefix))

// Служебные файлы самого каталога-зеркала (`.openspec-target` пишет `openspec
// init`, он говорит вендору, какой харнесс здесь живёт). Лежат в корне
// `.agents/skills/`, источника в `.claude/skills/` не имеют и удалению не подлежат.
const isTargetOwnedFile = (relativePath) => !toPosix(relativePath).includes('/')

const parseFrontmatter = (text) => {
  const match = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  return match ? { frontmatter: match[1], body: String(text).slice(match[0].length) } : { frontmatter: '', body: String(text) }
}

const yamlScalar = (frontmatter, key) => {
  const lines = String(frontmatter).split(/\r?\n/)
  const index = lines.findIndex((line) => line.startsWith(`${key}:`))
  if (index < 0) return ''
  const inline = lines[index].slice(key.length + 1).trim()
  if (/^[>|][+-]?$/.test(inline)) {
    const folded = []
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (!/^\s+/.test(lines[cursor])) break
      if (lines[cursor].trim()) folded.push(lines[cursor].trim())
    }
    return folded.join(' ')
  }
  const quoted = inline.match(/^(["'])([\s\S]*)\1$/)
  return quoted ? quoted[2] : inline
}

const renderCommandSkill = (command, commandFileContent) => {
  const { frontmatter, body } = parseFrontmatter(commandFileContent)
  const name = `${COMMAND_SKILL_PREFIX}${command}`
  const description = yamlScalar(frontmatter, 'description') || `Слэш-команда проекта ${command}`

  return `---
name: ${JSON.stringify(name)}
description: ${JSON.stringify(description)}
---

# ${name}

Use this skill when the user asks to run the migrated source command \`${command}\`.

## Command Template

${body.replace(/^\n+/, '').replace(/\s*$/, '')}
`
}

// Чистое ядро: на вход — три плоских списка `{ path, content }`, на выход —
// план правок. Без файловой системы, чтобы гейт и тест считали одно и то же.
// `commandFiles` не передан — проверка команд выключена (скилл-only план в
// тестах). Пустой массив — все MIRRORED_COMMANDS пропали, CLI так и считает.
const planSync = ({ sourceSkillFiles = [], commandFiles, targetFiles = [], sourceRootExists = true } = {}) => {
  const expected = new Map()

  for (const file of sourceSkillFiles) {
    const relativePath = toPosix(file.path)
    if (isVendorOwned(topSegment(relativePath))) continue
    expected.set(relativePath, { ...file, origin: `${toPosix(SOURCE_SKILLS_DIR)}/${relativePath}` })
  }

  const sourceNames = new Set([...expected.keys()].filter((file) => file.includes('/')).map(topSegment))
  const missingSources = [...sourceNames]
    .filter((name) => !expected.has(`${name}/SKILL.md`))
    .map((name) => `${toPosix(SOURCE_SKILLS_DIR)}/${name}/SKILL.md`)
  const hasProjectMirror = targetFiles.some(({ path: file }) => {
    const name = topSegment(file)
    return !isTargetOwnedFile(file) && !isVendorOwned(name) && !name.startsWith(COMMAND_SKILL_PREFIX)
  })
  if (!sourceRootExists || (!sourceNames.size && hasProjectMirror)) {
    missingSources.push(toPosix(SOURCE_SKILLS_DIR))
  }

  const providedCommandFiles = commandFiles ?? []
  const commandsByName = new Map(providedCommandFiles.map((file) => [toPosix(file.path).replace(/\.md$/, ''), file.content]))
  for (const command of MIRRORED_COMMANDS) {
    if (!commandsByName.has(command)) continue
    const relativePath = `${COMMAND_SKILL_PREFIX}${command}/SKILL.md`
    expected.set(relativePath, {
      executable: false,
      content: renderCommandSkill(command, commandsByName.get(command)),
      origin: `${toPosix(SOURCE_COMMANDS_DIR)}/${command}.md`,
    })
  }

  const missingCommands = commandFiles == null
    ? []
    : MIRRORED_COMMANDS.filter((command) => !commandsByName.has(command))

  const targetByPath = new Map(targetFiles.map((file) => [toPosix(file.path), file]))
  const writes = []
  for (const [relativePath, source] of expected) {
    if (sameMirrorFile(source, targetByPath.get(relativePath))) continue
    writes.push({
      ...source,
      path: relativePath,
      reason: targetByPath.has(relativePath) ? 'копия разошлась с источником' : 'копии нет на Codex-пути',
    })
  }

  const deletes = []
  for (const relativePath of targetByPath.keys()) {
    if (expected.has(relativePath)) continue
    if (isTargetOwnedFile(relativePath)) continue
    if (isVendorOwned(topSegment(relativePath))) continue
    deletes.push({ path: relativePath, reason: 'источника в .claude/skills нет' })
  }

  return {
    ok: writes.length === 0 && deletes.length === 0 && missingCommands.length === 0 && missingSources.length === 0,
    writes: writes.sort((a, b) => a.path.localeCompare(b.path)),
    deletes: deletes.sort((a, b) => a.path.localeCompare(b.path)),
    missingCommands,
    missingSources,
    mirrored: expected.size,
  }
}

const buildJsonResult = (plan) => ({
  contractVersion: OUTPUT_CONTRACT_VERSION,
  ok: plan.ok,
  mirrored: plan.mirrored,
  writes: plan.writes.map(({ path: filePath, origin, reason }) => ({ path: filePath, origin, reason })),
  deletes: plan.deletes,
  missingCommands: plan.missingCommands,
  missingSources: plan.missingSources,
})

const main = () => {
  const args = parseMirrorArgs(process.argv.slice(2))
  const rootDir = process.cwd()

  const projectSkill = (file) => !isVendorOwned(topSegment(file))
  const sourceRoot = path.join(rootDir, SOURCE_SKILLS_DIR)
  const plan = planSync({
    sourceSkillFiles: collectFiles(sourceRoot, projectSkill),
    sourceRootExists: fs.existsSync(sourceRoot),
    commandFiles: collectFiles(path.join(rootDir, SOURCE_COMMANDS_DIR), (file) => MIRRORED_COMMANDS.includes(file.replace(/\.md$/, ''))),
    targetFiles: collectFiles(path.join(rootDir, TARGET_SKILLS_DIR), projectSkill),
  })

  const blocked = plan.missingCommands.length > 0 || plan.missingSources.length > 0
  if (args.output === 'json') {
    process.stdout.write(`${JSON.stringify({ ...buildJsonResult(plan), mode: args.check ? 'check' : 'write' }, null, 2)}\n`)
    if ((args.check && !plan.ok) || blocked) process.exit(1)
    if (!args.check) applyMirrorPlan(path.join(rootDir, TARGET_SKILLS_DIR), plan)
    return
  }

  if (args.check || blocked) {
    if (plan.ok) {
      console.log(`agent-skill-sync: passed. зеркало .agents/skills совпадает с .claude/skills (${plan.mirrored} файлов)`)
      return
    }
    console.error('agent-skill-sync: failed.')
    for (const write of plan.writes) {
      console.error(`  ${toPosix(TARGET_SKILLS_DIR)}/${write.path} — ${write.reason} (источник ${write.origin})`)
    }
    for (const remove of plan.deletes) {
      console.error(`  ${toPosix(TARGET_SKILLS_DIR)}/${remove.path} — ${remove.reason}`)
    }
    for (const command of plan.missingCommands) {
      console.error(`  ${toPosix(SOURCE_COMMANDS_DIR)}/${command}.md — команда из MIRRORED_COMMANDS исчезла`)
    }
    for (const missing of plan.missingSources) console.error(`  ${missing} — отсутствует источник скилла`)
    console.error('- правь скилл в .claude/skills (единственный источник правды), затем: npm run sync:agent-skills')
    process.exit(1)
  }

  applyMirrorPlan(path.join(rootDir, TARGET_SKILLS_DIR), plan)
  console.log(
    `agent-skill-sync: synced. записано ${plan.writes.length}, удалено ${plan.deletes.length}, зеркало держит ${plan.mirrored} файлов`,
  )
}

if (require.main === module) {
  main()
}

module.exports = {
  OUTPUT_CONTRACT_VERSION,
  MIRRORED_COMMANDS,
  VENDOR_OWNED_SKILLS,
  planSync,
  renderCommandSkill,
  buildJsonResult,
}
