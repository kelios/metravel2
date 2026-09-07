const fs = require('fs')
const path = require('path')

const { planSync, MIRRORED_SKILLS } = require('@/scripts/sync-copilot-skills')
const { makeTempDir, removeDir, runCli, writeTextFile } = require('./cli-test-utils')

// #1823: `.github/skills/metravel-*` — снимки `.codex/skills`, адресуемые по имени
// из `.github/copilot-instructions.md`. Генератора у них не было, поэтому замер
// 06.09.2026 нашёл 17 расходящихся пар из 17: `metravel-devops-agent` усох с
// 6 453 Б до 3 376 Б, у `metravel-i18n-guardrails` файла-спутника
// `agents/openai.yaml` не было вовсе. Сессия шла по маршруту и получала
// инструкцию на поколение старше действующей.

const only = ['metravel-qa-agent']

describe('sync-copilot-skills', () => {
  it('ловит снимок, отставший от оригинала (реальный класс #1823: тело на поколение старше)', () => {
    const plan = planSync({
      mirroredSkills: only,
      sourceFiles: [{ path: 'metravel-qa-agent/SKILL.md', content: '`AGENTS.md` is inherited.' }],
      targetFiles: [{ path: 'metravel-qa-agent/SKILL.md', content: 'Read first:\n\n- `AGENTS.md`\n- `docs/RULES.md`' }],
    })

    expect(plan.ok).toBe(false)
    expect(plan.writes).toHaveLength(1)
    expect(plan.writes[0].path).toBe('metravel-qa-agent/SKILL.md')
    expect(plan.writes[0].reason).toContain('разошёлся')
    expect(plan.writes[0].content).toBe('`AGENTS.md` is inherited.')
  })

  it('ловит недостающий файл-спутник (реальный случай metravel-i18n-guardrails без agents/openai.yaml)', () => {
    const plan = planSync({
      mirroredSkills: ['metravel-i18n-guardrails'],
      sourceFiles: [
        { path: 'metravel-i18n-guardrails/SKILL.md', content: 'локализация' },
        { path: 'metravel-i18n-guardrails/agents/openai.yaml', content: 'short_description: "..."' },
      ],
      targetFiles: [{ path: 'metravel-i18n-guardrails/SKILL.md', content: 'локализация' }],
    })

    expect(plan.ok).toBe(false)
    expect(plan.writes.map((write: { path: string }) => write.path)).toEqual([
      'metravel-i18n-guardrails/agents/openai.yaml',
    ])
    expect(plan.writes[0].reason).toContain('нет на Copilot-пути')
  })

  it('молчит, когда зеркало совпадает побайтово (позитивная проба)', () => {
    const plan = planSync({
      mirroredSkills: only,
      sourceFiles: [{ path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' }],
      targetFiles: [{ path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' }],
    })

    expect(plan.ok).toBe(true)
    expect(plan.writes).toHaveLength(0)
    expect(plan.deletes).toHaveLength(0)
  })

  it('не трогает vendor-owned speckit-* ни на запись, ни на удаление', () => {
    const plan = planSync({
      mirroredSkills: only,
      sourceFiles: [{ path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' }],
      targetFiles: [
        { path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' },
        { path: 'speckit-plan/SKILL.md', content: 'вендорный spec-kit, источника в .codex нет' },
      ],
    })

    expect(plan.ok).toBe(true)
    expect(plan.writes).toHaveLength(0)
    expect(plan.deletes).toHaveLength(0)
  })

  it('не зеркалит скиллы .codex вне списка: состав Copilot-поверхности остаётся решением', () => {
    const plan = planSync({
      mirroredSkills: only,
      sourceFiles: [
        { path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' },
        { path: 'metravel-ios-release-operator/SKILL.md', content: 'оператор релиза iPhone' },
      ],
      targetFiles: [{ path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' }],
    })

    expect(plan.ok).toBe(true)
    expect(plan.writes).toHaveLength(0)
  })

  it('удаляет файл снимка, у которого источник в .codex/skills исчез', () => {
    const plan = planSync({
      mirroredSkills: only,
      sourceFiles: [{ path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' }],
      targetFiles: [
        { path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' },
        { path: 'metravel-qa-agent/agents/openai.yaml', content: 'спутник, которого в источнике больше нет' },
      ],
    })

    expect(plan.ok).toBe(false)
    expect(plan.deletes).toEqual([
      { path: 'metravel-qa-agent/agents/openai.yaml', reason: 'источника в .codex/skills нет' },
    ])
  })

  it('краснеет, когда объявленный скилл исчез из .codex/skills, вместо тихого зелёного', () => {
    const plan = planSync({
      mirroredSkills: ['metravel-qa-agent', 'metravel-code-reviewer'],
      sourceFiles: [{ path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' }],
      targetFiles: [{ path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' }],
    })

    expect(plan.ok).toBe(false)
    expect(plan.missingSkills).toEqual(['metravel-code-reviewer'])
    expect(plan.writes).toHaveLength(0)
    expect(plan.deletes).toHaveLength(0)
  })

  it('не предлагает снести скилл, у которого источник исчез целиком: это блокер, а не удаление', () => {
    const plan = planSync({
      mirroredSkills: ['metravel-qa-agent', 'metravel-docs-maintainer'],
      sourceFiles: [{ path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' }],
      targetFiles: [
        { path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' },
        { path: 'metravel-docs-maintainer/SKILL.md', content: 'живой Copilot-маршрут' },
        { path: 'metravel-docs-maintainer/agents/openai.yaml', content: 'short_description: "..."' },
      ],
    })

    expect(plan.ok).toBe(false)
    expect(plan.missingSkills).toEqual(['metravel-docs-maintainer'])
    // `--json` не должен советовать потребителю удаление, которое сам скрипт делать отказывается.
    expect(plan.deletes).toHaveLength(0)
  })

  it('краснеет на бесхозном metravel-снимке без объявления — это исходный дефект #1823, а не новый скилл', () => {
    const plan = planSync({
      mirroredSkills: only,
      sourceFiles: [{ path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' }],
      targetFiles: [
        { path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' },
        { path: 'metravel-docs-maintainer/SKILL.md', content: 'снимок, который никто не объявил' },
      ],
    })

    expect(plan.ok).toBe(false)
    expect(plan.unownedSkills).toEqual(['metravel-docs-maintainer'])
    // Молча удалять нельзя: снимок мог быть добавлен осознанно, и правка — в MIRRORED_SKILLS.
    expect(plan.deletes).toHaveLength(0)
  })

  it('не претендует на Copilot-native скиллы без оригинала в .codex', () => {
    const plan = planSync({
      mirroredSkills: only,
      sourceFiles: [{ path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' }],
      targetFiles: [
        { path: 'metravel-qa-agent/SKILL.md', content: 'QA\n' },
        { path: 'copilot-only-helper/SKILL.md', content: 'скилл, живущий только на стороне Copilot' },
      ],
    })

    expect(plan.ok).toBe(true)
    expect(plan.deletes).toHaveLength(0)
    expect(plan.unownedSkills).toHaveLength(0)
  })

  it('объявленный список покрывает ровно те снимки, что лежат в .github/skills', () => {
    expect(MIRRORED_SKILLS).toHaveLength(17)
    expect(new Set(MIRRORED_SKILLS).size).toBe(MIRRORED_SKILLS.length)
    expect(MIRRORED_SKILLS.every((name: string) => name.startsWith('metravel-'))).toBe(true)
  })
})

// Гейт живёт как CLI, и защита «при блокере зеркало не переписывается» держится не
// планом, а порядком веток в `main()`. Пробы ниже гоняют скрипт целиком: `.github/skills`
// адресуется по имени из `.github/copilot-instructions.md`, и ошибочная запись здесь
// стирает живой Copilot-маршрут.
describe('sync-copilot-skills CLI', () => {
  const scriptPath = path.join(process.cwd(), 'scripts', 'sync-copilot-skills.js')
  let rootDir: string

  const skillFile = (family: string, skill: string) => path.join(rootDir, family, 'skills', skill, 'SKILL.md')

  // `cwd` берётся на каждом вызове: `rootDir` создаётся в `beforeEach`, и опции,
  // собранные один раз в теле `describe`, увели бы прогон в корень репозитория —
  // там зеркало сходится и гейт зеленел бы мимо фикстуры.
  const run = (args: string[]) => runCli(process.execPath, [scriptPath, ...args], { cwd: rootDir })

  const mirrorBody = () => fs.readFileSync(skillFile('.github', 'metravel-qa-agent'), 'utf8')

  beforeEach(() => {
    rootDir = makeTempDir('copilot-skills-')
    // Один объявленный скилл присутствует и разошёлся со снимком, остальные шестнадцать
    // в фикстуре отсутствуют — это и есть блокер `missingSkills` в терминах полного
    // MIRRORED_SKILLS, который CLI читает из модуля.
    writeTextFile(skillFile('.codex', 'metravel-qa-agent'), 'НОВОЕ ТЕЛО\n')
    writeTextFile(skillFile('.github', 'metravel-qa-agent'), 'СТАРОЕ ТЕЛО\n')
  })

  afterEach(() => {
    removeDir(rootDir)
  })

  it('при блокере не пишет в зеркало и выходит с кодом 1 (text)', () => {
    const result = run([])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('исчез из источника')
    expect(mirrorBody()).toBe('СТАРОЕ ТЕЛО\n')
  })

  it('при блокере не пишет в зеркало и выходит с кодом 1 (--json)', () => {
    const result = run(['--json'])
    const report = JSON.parse(result.stdout)

    expect(result.status).toBe(1)
    expect(report.mode).toBe('write')
    expect(report.ok).toBe(false)
    expect(report.missingSkills.length).toBeGreaterThan(0)
    expect(mirrorBody()).toBe('СТАРОЕ ТЕЛО\n')
  })

  it('--check краснеет на разошедшемся снимке и ничего не переписывает', () => {
    const result = run(['--check'])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('снимок разошёлся с источником')
    expect(mirrorBody()).toBe('СТАРОЕ ТЕЛО\n')
  })
})
