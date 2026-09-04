const { planSync, renderCommandSkill, MIRRORED_COMMANDS } = require('@/scripts/sync-agent-skills')

// #1770: `.claude/skills/**` — единственный источник правды, `.agents/skills/**`
// (Codex, `.openspec-target` = codex; Grok читает оба каталога) — производное
// зеркало. Замер 04.09.2026: 32 расходящиеся пары из 32, у трёх скиллов
// `.agents`-копия отставала на поколение и правило FAQ из #1765 в ней
// отсутствовало целиком.

const commandFile = `---
description: Полная preflight-проверка перед push
allowed-tools: Bash(npm run check:preflight)
---

Прогон \`npm run check:preflight\` — эквивалент pre-push хука.
`

describe('sync-agent-skills', () => {
  it('ловит копию, разошедшуюся с источником (реальный класс #1765: правило есть в .claude, нет в .agents)', () => {
    const plan = planSync({
      sourceSkillFiles: [{ path: 'metravel-travel-article/SKILL.md', content: 'FAQ пишется только <details>/<summary>.' }],
      targetFiles: [{ path: 'metravel-travel-article/SKILL.md', content: 'Про FAQ здесь не сказано ничего.' }],
    })

    expect(plan.ok).toBe(false)
    expect(plan.writes).toHaveLength(1)
    expect(plan.writes[0].path).toBe('metravel-travel-article/SKILL.md')
    expect(plan.writes[0].reason).toContain('разошлась')
    expect(plan.writes[0].content).toContain('<details>/<summary>')
  })

  it('ловит скилл, которого на Codex-пути нет вовсе, включая файлы-спутники', () => {
    const plan = planSync({
      sourceSkillFiles: [
        { path: 'ios-release/SKILL.md', content: 'релиз iPhone' },
        { path: 'metravel-quest/REVIEW_BRIEF.md', content: 'бриф ревью' },
      ],
      targetFiles: [],
    })

    expect(plan.ok).toBe(false)
    expect(plan.writes.map((write: { path: string }) => write.path)).toEqual([
      'ios-release/SKILL.md',
      'metravel-quest/REVIEW_BRIEF.md',
    ])
    expect(plan.writes[0].reason).toContain('нет на Codex-пути')
  })

  it('молчит, когда зеркало совпадает побайтово (позитивная проба)', () => {
    const plan = planSync({
      sourceSkillFiles: [{ path: 'review-code/SKILL.md', content: 'ревью кода\n' }],
      targetFiles: [{ path: 'review-code/SKILL.md', content: 'ревью кода\n' }],
    })

    expect(plan.ok).toBe(true)
    expect(plan.writes).toHaveLength(0)
    expect(plan.deletes).toHaveLength(0)
  })

  it('не трогает vendor-owned openspec-* ни на запись, ни на удаление', () => {
    const plan = planSync({
      sourceSkillFiles: [{ path: 'openspec-propose/SKILL.md', content: 'compatibility: Requires openspec CLI.\n/openspec-propose' }],
      targetFiles: [{ path: 'openspec-propose/SKILL.md', content: '$openspec-propose (Codex) or /openspec-propose (other agents)' }],
    })

    expect(plan.ok).toBe(true)
    expect(plan.writes).toHaveLength(0)
    expect(plan.deletes).toHaveLength(0)
  })

  it('сохраняет служебный файл каталога-зеркала (.openspec-target от openspec init)', () => {
    const plan = planSync({
      sourceSkillFiles: [],
      targetFiles: [{ path: '.openspec-target', content: 'codex\n' }],
    })

    expect(plan.deletes).toHaveLength(0)
    expect(plan.ok).toBe(true)
  })

  it('удаляет копию скилла, у которого источник в .claude/skills исчез', () => {
    const plan = planSync({
      sourceSkillFiles: [],
      targetFiles: [{ path: 'retired-skill/SKILL.md', content: 'старый скилл' }],
    })

    expect(plan.ok).toBe(false)
    expect(plan.deletes).toEqual([{ path: 'retired-skill/SKILL.md', reason: 'источника в .claude/skills нет' }])
  })

  it('собирает обёртку слэш-команды из тела команды, а не из отдельной рукописной копии', () => {
    const rendered = renderCommandSkill('preflight', commandFile)

    expect(rendered).toContain('name: "source-command-preflight"')
    expect(rendered).toContain('description: "Полная preflight-проверка перед push"')
    expect(rendered).toContain('Use this skill when the user asks to run the migrated source command `preflight`.')
    expect(rendered).toContain('Прогон `npm run check:preflight` — эквивалент pre-push хука.')
    // Frontmatter команды (в т.ч. Claude-специфичный allowed-tools) в обёртку не переносится.
    expect(rendered).not.toContain('allowed-tools')
  })

  it('краснеет, когда команда из MIRRORED_COMMANDS исчезла из .claude/commands, вместо тихого зелёного', () => {
    const plan = planSync({
      sourceSkillFiles: [],
      commandFiles: [{ path: 'preflight.md', content: commandFile }],
      targetFiles: [{ path: 'source-command-preflight/SKILL.md', content: renderCommandSkill('preflight', commandFile) }],
    })

    expect(plan.ok).toBe(false)
    expect(plan.missingCommands).toEqual(MIRRORED_COMMANDS.filter((command: string) => command !== 'preflight'))
    expect(plan.writes).toHaveLength(0)
  })
})
