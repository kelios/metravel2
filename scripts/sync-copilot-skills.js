#!/usr/bin/env node
const path = require('path')
const { toPosix, topSegment, collectFiles, applyMirrorPlan, parseMirrorArgs } = require('./lib/skillMirror')

// #1823: `.github/skills/` — третий комплект скиллов в репозитории и живая
// Copilot-поверхность: десять `metravel-*` адресуются по имени из
// `.github/copilot-instructions.md`, значит каталог не декоративный. Генератора у
// него не было, поэтому снимки, снятые с `.codex/skills` 20.08.2026, тихо
// старели: замер 06.09.2026 нашёл 17 расходящихся пар из 17, причём
// `metravel-devops-agent` усох с 6 453 Б до 3 376 Б, а `metravel-i18n-guardrails`
// с 3 795 Б до 1 457 Б — это не косметика, а инструкция на поколение старше
// действующей. Сессия, пришедшая по маршруту из `copilot-instructions.md`,
// получала её как актуальную.
//
// Здесь `.codex/skills/<имя>` объявлен единственным источником правды, а
// `.github/skills/<имя>` — производным зеркалом: побайтовой копией каталога
// скилла без текстовых подстановок. Подстановки допустимы там, где у vendor'а
// свой диалект; сверка 06.09.2026 показала, что у снимков его нет — ни одного
// упоминания Copilot, ни одной GitHub-специфичной строки, только устаревшие тела.
// Оригиналом выбран `.codex/skills`, а не `.claude/skills`: все 17 имён есть
// именно там, раскладка файлов совпадает один-в-один, а в `.claude/skills` живёт
// другое семейство имён.

const OUTPUT_CONTRACT_VERSION = 1

const SOURCE_SKILLS_DIR = path.join('.codex', 'skills')
const TARGET_SKILLS_DIR = path.join('.github', 'skills')

// Список явный, а не «все скиллы из `.codex/skills`»: там 57 каталогов, и
// зеркалить их целиком значило бы вывалить на Copilot роли, которые ему не
// адресуются (операторы релизов, board, устройства). Зеркалятся ровно те 17,
// которые в `.github/skills` уже лежали снимками, — состав поверхности остаётся
// решением, а не побочным эффектом.
const MIRRORED_SKILLS = [
  'metravel-agent-workflow',
  'metravel-business-analyst',
  'metravel-code-reviewer',
  'metravel-devops-agent',
  'metravel-docs-maintainer',
  'metravel-e2e-runner',
  'metravel-feature-builder',
  'metravel-hook-builder',
  'metravel-i18n-guardrails',
  'metravel-performance-analyst',
  'metravel-qa-agent',
  'metravel-quality-fixer',
  'metravel-release-checks',
  'metravel-system-architect',
  'metravel-test-runner',
  'metravel-test-writer',
  'metravel-ui-guardrails',
]

// Vendor-owned: `speckit-*` кладёт сам spec-kit через
// `.specify/integrations/copilot.manifest.json` и отслеживает их хеши. Источника
// в `.codex/skills` у них нет, править руками нельзя — по образцу `openspec-*` в
// паре `.claude`/`.agents`.
const VENDOR_OWNED_SKILLS = ['speckit-']

// Все скиллы-оригиналы называются `metravel-*`, поэтому префикс — точный
// признак «это снимок нашего скилла». Каталог с таким именем, не объявленный в
// MIRRORED_SKILLS, — снова бесхозная копия без владельца и без гейта, то есть
// ровно исходный дефект; гейт краснеет вместо того, чтобы молча её терпеть или
// молча удалить. Прочие каталоги (Copilot-native скиллы без оригинала) зеркало
// не трогает: оно на них не претендует.
const MIRRORED_SKILL_PREFIX = 'metravel-'

const isVendorOwned = (skillName) => VENDOR_OWNED_SKILLS.some((prefix) => skillName.startsWith(prefix))

// Чистое ядро: на вход — два плоских списка `{ path, content }`, на выход — план
// правок. Без файловой системы, чтобы гейт и тест считали одно и то же.
// `mirroredSkills` вынесен в параметр, а не читается из модуля: иначе проба на
// один скилл считалась бы красной из-за шестнадцати «пропавших» соседей, и тест
// не смог бы отличить реальную находку от этого шума. CLI передаёт полный список.
const planSync = ({ sourceFiles = [], targetFiles = [], mirroredSkills = MIRRORED_SKILLS } = {}) => {
  const mirrored = new Set(mirroredSkills)

  const expected = new Map()
  for (const file of sourceFiles) {
    const relativePath = toPosix(file.path)
    if (!mirrored.has(topSegment(relativePath))) continue
    expected.set(relativePath, { content: file.content, origin: `${toPosix(SOURCE_SKILLS_DIR)}/${relativePath}` })
  }

  const presentSources = new Set([...expected.keys()].map(topSegment))
  const missingSkills = [...mirrored].filter((skillName) => !presentSources.has(skillName))

  const targetByPath = new Map(targetFiles.map((file) => [toPosix(file.path), file.content]))

  const writes = []
  for (const [relativePath, { content, origin }] of expected) {
    if (targetByPath.get(relativePath) === content) continue
    writes.push({
      path: relativePath,
      content,
      origin,
      reason: targetByPath.has(relativePath) ? 'снимок разошёлся с источником' : 'снимка нет на Copilot-пути',
    })
  }

  const deletes = []
  const unownedSkills = new Set()
  for (const relativePath of targetByPath.keys()) {
    const skillName = topSegment(relativePath)
    if (isVendorOwned(skillName)) continue
    if (mirrored.has(skillName)) {
      // Удаляются только файлы внутри скилла, который в источнике остался. Скилл,
      // исчезнувший из `.codex/skills` целиком, — блокер `missingSkills`: синхронизация
      // не знает, переименовали его или удалили, и не должна выдавать план на снос
      // живого Copilot-маршрута. Иначе `--json` советовал бы потребителю ровно то
      // удаление, которое сам же отказывается выполнять.
      if (!expected.has(relativePath) && presentSources.has(skillName)) {
        deletes.push({ path: relativePath, reason: 'источника в .codex/skills нет' })
      }
      continue
    }
    if (skillName.startsWith(MIRRORED_SKILL_PREFIX)) unownedSkills.add(skillName)
  }

  return {
    ok: writes.length === 0 && deletes.length === 0 && missingSkills.length === 0 && unownedSkills.size === 0,
    writes: writes.sort((a, b) => a.path.localeCompare(b.path)),
    deletes: deletes.sort((a, b) => a.path.localeCompare(b.path)),
    missingSkills,
    unownedSkills: [...unownedSkills].sort((a, b) => a.localeCompare(b)),
    mirrored: expected.size,
  }
}

const buildJsonResult = (plan) => ({
  contractVersion: OUTPUT_CONTRACT_VERSION,
  ok: plan.ok,
  mirrored: plan.mirrored,
  writes: plan.writes.map(({ path: filePath, origin, reason }) => ({ path: filePath, origin, reason })),
  deletes: plan.deletes,
  missingSkills: plan.missingSkills,
  unownedSkills: plan.unownedSkills,
})

// Пропавший источник и бесхозный снимок синхронизация не чинит: она не знает,
// скилл переименовали или удалили. Обе ситуации — правка MIRRORED_SKILLS, поэтому
// при них зеркало не переписывается ни в одном из режимов вывода.
const hasBlockers = (plan) => plan.missingSkills.length > 0 || plan.unownedSkills.length > 0

const reportBlockers = (plan, log) => {
  for (const skillName of plan.missingSkills) {
    log(`  ${toPosix(SOURCE_SKILLS_DIR)}/${skillName} — скилл из MIRRORED_SKILLS исчез из источника`)
  }
  for (const skillName of plan.unownedSkills) {
    log(`  ${toPosix(TARGET_SKILLS_DIR)}/${skillName} — снимок без объявления в MIRRORED_SKILLS`)
  }
}

const main = () => {
  const args = parseMirrorArgs(process.argv.slice(2))
  const rootDir = process.cwd()

  const plan = planSync({
    sourceFiles: collectFiles(path.join(rootDir, SOURCE_SKILLS_DIR)),
    targetFiles: collectFiles(path.join(rootDir, TARGET_SKILLS_DIR)),
  })

  if (args.output === 'json') {
    process.stdout.write(`${JSON.stringify({ ...buildJsonResult(plan), mode: args.check ? 'check' : 'write' }, null, 2)}\n`)
    if (args.check) {
      if (!plan.ok) process.exit(1)
      return
    }
    if (hasBlockers(plan)) process.exit(1)
    applyMirrorPlan(path.join(rootDir, TARGET_SKILLS_DIR), plan)
    return
  }

  if (args.check) {
    if (plan.ok) {
      console.log(`copilot-skill-sync: passed. зеркало .github/skills совпадает с .codex/skills (${plan.mirrored} файлов)`)
      return
    }
    console.error('copilot-skill-sync: failed.')
    for (const write of plan.writes) {
      console.error(`  ${toPosix(TARGET_SKILLS_DIR)}/${write.path} — ${write.reason} (источник ${write.origin})`)
    }
    for (const remove of plan.deletes) {
      console.error(`  ${toPosix(TARGET_SKILLS_DIR)}/${remove.path} — ${remove.reason}`)
    }
    reportBlockers(plan, console.error)
    console.error('- правь скилл в .codex/skills (единственный источник правды), затем: npm run sync:copilot-skills')
    process.exit(1)
  }

  if (hasBlockers(plan)) {
    console.error('copilot-skill-sync: failed.')
    reportBlockers(plan, console.error)
    process.exit(1)
  }

  applyMirrorPlan(path.join(rootDir, TARGET_SKILLS_DIR), plan)
  console.log(
    `copilot-skill-sync: synced. записано ${plan.writes.length}, удалено ${plan.deletes.length}, зеркало держит ${plan.mirrored} файлов`,
  )
}

if (require.main === module) {
  main()
}

module.exports = {
  OUTPUT_CONTRACT_VERSION,
  MIRRORED_SKILLS,
  VENDOR_OWNED_SKILLS,
  planSync,
  buildJsonResult,
}
