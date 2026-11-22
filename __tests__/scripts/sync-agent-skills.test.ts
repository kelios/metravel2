const fs = require('fs')
const path = require('path')
const { planSync, renderCommandSkill, MIRRORED_COMMANDS } = require('@/scripts/sync-agent-skills')
const { collectFiles, applyMirrorPlan } = require('@/scripts/lib/skillMirror')
const { makeTempDir, removeDir, runCli, writeTextFile } = require('./cli-test-utils')

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
  it('исключает Python-кэши из всех трёх сканов, но обнаруживает изменение исходного скрипта', () => {
    const root = makeTempDir('metravel-skill-mirror-')
    const sourceRoot = path.join(root, 'source-skills')
    const commandRoot = path.join(root, 'commands')
    const targetRoot = path.join(root, 'target-skills')
    const scriptPath = 'example/scripts/publish.py'
    try {
      for (const dir of [sourceRoot, targetRoot]) {
        writeTextFile(path.join(dir, 'example/SKILL.md'), 'Example skill\n')
        writeTextFile(path.join(dir, scriptPath), 'print("original")\n')
        writeTextFile(path.join(dir, 'example/scripts/__pycache__/publish.cpython-314.pyc'), dir)
        writeTextFile(path.join(dir, 'example/scripts/__pycache__/nested/SKILL.md'), dir)
      }
      // Standalone bytecode and target-only caches must neither be copied nor deleted.
      writeTextFile(path.join(sourceRoot, 'example/source-only.pyc'), 'source cache')
      writeTextFile(path.join(targetRoot, 'example/target-only.pyc'), 'target cache')
      writeTextFile(path.join(targetRoot, 'retired/__pycache__/publish.pyc'), 'target-only cache')
      writeTextFile(path.join(commandRoot, '__pycache__/preflight.md'), 'generated cache')
      writeTextFile(path.join(commandRoot, 'preflight.pyc'), 'standalone cache')
      for (const command of MIRRORED_COMMANDS) {
        writeTextFile(path.join(commandRoot, `${command}.md`), commandFile)
        writeTextFile(path.join(targetRoot, `source-command-${command}/SKILL.md`), renderCommandSkill(command, commandFile))
      }
      const scan = () => ({
        sourceSkillFiles: collectFiles(sourceRoot),
        commandFiles: collectFiles(commandRoot),
        targetFiles: collectFiles(targetRoot),
      })
      const files = scan()
      expect(files.sourceSkillFiles.map((file: { path: string }) => file.path).sort()).toEqual(['example/SKILL.md', scriptPath].sort())
      expect(files.commandFiles.map((file: { path: string }) => file.path)).toEqual([...MIRRORED_COMMANDS].sort().map((command: string) => `${command}.md`))
      expect(files.targetFiles).toHaveLength(2 + MIRRORED_COMMANDS.length)
      const cleanPlan = planSync(files)
      expect(cleanPlan.ok).toBe(true)
      expect(cleanPlan.writes).toEqual([])
      expect(cleanPlan.deletes).toEqual([])

      writeTextFile(path.join(sourceRoot, scriptPath), 'print("changed")\n')
      const changedPlan = planSync(scan())
      expect(changedPlan.ok).toBe(false)
      expect(changedPlan.writes).toEqual([expect.objectContaining({ path: scriptPath, content: Buffer.from('print("changed")\n') })])
      expect(changedPlan.deletes).toEqual([])
    } finally {
      removeDir(root)
    }
  })

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
      sourceSkillFiles: [{ path: 'active/SKILL.md', content: 'active' }],
      targetFiles: [{ path: 'active/SKILL.md', content: 'active' }, { path: 'retired-skill/SKILL.md', content: 'старый скилл' }],
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

it('round-trips binary assets and executable helpers from the source skill', () => {
  const root = makeTempDir('skill-resources-')
  try {
    const source = path.join(root, 'source')
    const target = path.join(root, 'mirror')
    const file = 'helper/scripts/example'
    writeTextFile(path.join(source, 'helper/SKILL.md'), 'example')
    writeTextFile(path.join(source, file), '')
    const bytes = Buffer.from([0xff, 0x00, 0x82])
    fs.writeFileSync(path.join(source, file), bytes)
    fs.chmodSync(path.join(source, file), 0o755)
    const scan = () => planSync({ sourceSkillFiles: collectFiles(source), targetFiles: collectFiles(target) })
    applyMirrorPlan(target, scan())
    expect(fs.readFileSync(path.join(target, file))).toEqual(bytes)
    expect(scan().ok).toBe(true)
    if (process.platform !== 'win32') {
      expect(fs.statSync(path.join(target, file)).mode & 0o100).toBe(0o100)
      fs.chmodSync(path.join(source, file), 0o644)
      expect(scan().writes).toHaveLength(1)
      applyMirrorPlan(target, scan())
      expect(fs.statSync(path.join(target, file)).mode & 0o111).toBe(0)
      expect(scan().ok).toBe(true)
    }
  } finally {
    removeDir(root)
  }
})

it('preserves existing wrappers in JSON write mode when a source command is missing', () => {
  const root = makeTempDir('skill-missing-command-')
  try {
    const wrapper = path.join(root, '.agents/skills/source-command-preflight/SKILL.md')
    writeTextFile(wrapper, 'existing wrapper\n')
    const script = path.resolve('scripts/sync-agent-skills.js')
    const result = runCli(process.execPath, [script, '--json'], { cwd: root })
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout).missingCommands).toContain('preflight')
    expect(fs.readFileSync(wrapper, 'utf8')).toBe('existing wrapper\n')
  } finally {
    removeDir(root)
  }
})

it('keeps the last working mirror when the canonical directory or entrypoint is missing', () => {
  const root = makeTempDir('skill-missing-source-')
  try {
    const skill = path.join(root, '.agents/skills/example/SKILL.md')
    writeTextFile(skill, 'keep me')
    for (const command of MIRRORED_COMMANDS) writeTextFile(path.join(root, '.claude/commands', command + '.md'), commandFile)
    const script = path.resolve('scripts/sync-agent-skills.js')
    const verifyBlocked = (missing: string) => {
      const result = runCli(process.execPath, [script, '--json'], { cwd: root })
      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout).missingSources).toContain(missing)
      expect(fs.readFileSync(skill, 'utf8')).toBe('keep me')
    }
    verifyBlocked('.claude/skills')
    writeTextFile(path.join(root, '.claude/skills/openspec-explore/SKILL.md'), 'vendor')
    verifyBlocked('.claude/skills')
    writeTextFile(path.join(root, '.claude/skills/example/references/details.md'), 'notes')
    verifyBlocked('.claude/skills/example/SKILL.md')
  } finally {
    removeDir(root)
  }
})

it('refuses a managed symlink before sync can overwrite its external target', () => {
  const root = makeTempDir('skill-linked-resource-')
  try {
    const target = path.join(root, '.agents/skills/example/SKILL.md')
    const external = path.join(root, 'external.md')
    writeTextFile(external, 'keep me')
    writeTextFile(path.join(root, '.claude/skills/example/SKILL.md'), 'new instructions')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.symlinkSync(external, target)
    for (const command of MIRRORED_COMMANDS) writeTextFile(path.join(root, '.claude/commands', command + '.md'), commandFile)
    const result = runCli(process.execPath, [path.resolve('scripts/sync-agent-skills.js')], { cwd: root })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('symbolic link')
    expect(fs.readFileSync(external, 'utf8')).toBe('keep me')
  } finally {
    removeDir(root)
  }
})
