const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { makeTempDir, runCli } = require('./cli-test-utils')

const SCRIPT = path.join(__dirname, '../../scripts/instagram/lint-package.py')

const CLEAN_CAPTION = [
  'Касина-Велька из Кракова: круг 11,5 км с видом на Татры',
  '',
  'В субботу мы с Сергеем поехали в Бескид Выспова. Я давно хотела пройти этот круг осенью.',
  '',
  'Полный маршрут на metravel.by, ссылка в профиле. А вы были в Бескиде Выспова?',
  '',
  '#kasinawielka #beskidwyspowy #małopolska #metravel',
].join('\n')

// Чек-лист раздела 18 строкой на номер: по пакету без него линт даёт R18.
const CHECKLIST = [
  'Состав поездки: мы с Сергеем.',
  ...Array.from({ length: 11 }, (_, i) => `- V${i + 1} да.`),
  ...Array.from({ length: 13 }, (_, i) => `- F${i + 1} да.`),
].join('\n')

describe('instagram lint-package', () => {
  const root = makeTempDir('ig-lint-')
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

  const makePackage = (name: string, files: Record<string, string>) => {
    const dir = path.join(root, name)
    fs.mkdirSync(dir, { recursive: true })
    for (const [file, text] of Object.entries({ 'package.md': CHECKLIST, ...files })) {
      fs.writeFileSync(path.join(dir, file), text)
    }
    const day = new Date().toISOString().slice(0, 10)
    const sha256 = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, file))).digest('hex')
    fs.writeFileSync(path.join(dir, 'final.jpg'), 'test export')
    fs.writeFileSync(path.join(dir, 'evidence.txt'), 'Fixture: own image, organic Instagram worldwide, no third party material.')
    fs.writeFileSync(path.join(dir, 'rights.json'), JSON.stringify({
      version: 1, account: '@metravelby', reviewedAt: day, intendedPublishAt: day,
      assets: [{ file: 'final.jpg', sha256: sha256('final.jpg'), kind: 'image', basis: 'owned', source: 'Fixture own image',
        evidence: [{ file: 'evidence.txt', sha256: sha256('evidence.txt') }],
        scope: { account: '@metravelby', platforms: ['instagram'], uses: ['organic'], territories: ['worldwide'], validFrom: day, validUntil: 'perpetual' } }],
    }))
    return dir
  }

  const lint = (dir: string, extra: string[] = []) => {
    const run = runCli('python3', [SCRIPT, '--json', ...extra, dir])
    const hits = run.status === 2 ? [] : JSON.parse(run.stdout)
    return { status: run.status, rules: hits.map((h: { rule: string }) => h.rule).sort(), hits }
  }

  it('passes a clean package and reads slide text from spec.json', () => {
    const dir = makePackage('clean', {
      'caption.txt': CLEAN_CAPTION,
      'spec.json': JSON.stringify({ slides: [{ type: 'cover', title: 'Касина-Велька', subtitle: 'Круг 11,5 км' }] }),
    })
    expect(lint(dir)).toMatchObject({ status: 0, rules: [] })
  })

  it('flags service speech, cliches, third person, length, emoji and hashtags', () => {
    const caption = [
      '#польша Итак, Татры',
      '',
      'Юля прошла этот маршрут. Проверенных цифр у меня нет, время и цены я здесь не называю.',
      'Это настоящая жемчужина 🌲🌲🌲',
      'я'.repeat(1800),
      '',
      '#a #b',
    ].join('\n')
    const dir = makePackage('dirty', {
      'caption.txt': caption,
      'slides.txt': 'Все кадры в подборке зимние (данные на 11.10.2026)\n\nЗдесь, как пишет Центральная научная библиотека, побывал король\n',
    })
    const { status, rules, hits } = lint(dir)
    expect(status).toBe(1)
    expect(new Set(rules)).toEqual(new Set(['F3', 'F4', 'F5', 'F8', 'V3', 'V6', 'V8']))
    expect(hits.map((h: { message: string }) => h.message)).toContainEqual(
      expect.stringContaining('ссылка на источник вместо рассказа): «как пишет Центральная научная библиотек'))
  })

  it('scans every package text with the shared Belarus denylist', () => {
    const dir = makePackage('belarus', {
      'caption.txt': CLEAN_CAPTION,
      'sources.md': 'Легенда — в пересказе „Нашай Нівы“.\n',
    })
    const { status, hits } = lint(dir)
    expect(status).toBe(1)
    expect(hits).toEqual([expect.objectContaining({ rule: 'B1', source: 'sources.md', line: 1 })])
  })

  it('catches revealed quest answers and honours a reasoned lint-allow', () => {
    const data = path.join(root, 'demo-quest-data.js')
    fs.writeFileSync(data, [
      'module.exports = { quest_id: "demo-quest", steps: [',
      '  { answer_pattern: {"type":"exact_any","value":"[\\"нептун\\",\\"нептуна\\"]"} },',
      '  { answer_pattern: {"type":"exact","value":"5"} },',
      '] }',
    ].join('\n'))
    const files = {
      'caption.txt': CLEAN_CAPTION.replace('Я давно', 'Фонтан Нептуна стоит на рынке. Я давно'),
      'sources.md': 'Квест `quest_id = demo-quest`, `by-quest-id/demo-quest/`\n',
    }
    const leak = makePackage('quest-leak', files)
    expect(lint(leak, ['--quest-data', data])).toMatchObject({ status: 1, rules: ['F10'] })

    const byUrl = makePackage('quest-by-url', {
      'caption.txt': CLEAN_CAPTION.replace('Я давно', 'Фонтан Нептуна стоит на рынке, квест: metravel.by/quests/22/demo-quest. Я давно'),
    })
    expect(lint(byUrl, ['--quest-data', data])).toMatchObject({ status: 1, rules: ['F10'] })

    const allowed = makePackage('quest-allowed', {
      ...files,
      'package.md': `lint-allow: F10 нептуна — название фонтана на маршруте, задание о другом\n${CHECKLIST}`,
    })
    expect(lint(allowed, ['--quest-data', data])).toMatchObject({ status: 0, rules: [] })
  })

  it('reads answers from JS-module quest data (JSON.stringify, multi-line, ё and hyphen)', () => {
    const data = path.join(root, 'module-quest-data.js')
    fs.writeFileSync(data, [
      'module.exports = [{',
      "  quest_id: 'module-quest',",
      '  steps: [',
      "    { answer_pattern: { type: 'exact_any', value: JSON.stringify(['дышит огнем', 'сине зеленый']) } },",
      '    { answer_pattern: {',
      "        type: 'exact',",
      "        value: 'колодец',",
      '    } },',
      '  ],',
      '}]',
    ].join('\n'))
    const dir = makePackage('quest-module', {
      'caption.txt': CLEAN_CAPTION.replace('Я давно', 'Дракон дышит огнём, цвет воды сине-зелёный. Я давно'),
      'spec.json': JSON.stringify({ slides: [{ type: 'map', title: 'Карта', note: '', points: [{ name: 'Колодец', lat: 1, lng: 2 }] }] }),
      'brief.md': "Квест quest_id: 'module-quest'\n",
    })
    const { status, hits } = lint(dir, ['--quest-data', data])
    expect(status).toBe(1)
    expect(hits.map((h: { message: string }) => h.message).sort()).toEqual([
      'ответ задания квеста module-quest: «дышит огнем»',
      'ответ задания квеста module-quest: «колодец»',
      'ответ задания квеста module-quest: «сине зеленый»',
    ])
  })

  it('counts a skin-toned emoji once and does not flag a first word that only starts like a greeting', () => {
    const dir = makePackage('emoji', {
      'caption.txt': CLEAN_CAPTION
        .replace('Касина-Велька из Кракова', 'Приветливая Касина-Велька под Краковом')
        .replace('в профиле.', 'в профиле 👍🏽👍🏽.'),
    })
    expect(lint(dir)).toMatchObject({ status: 0, rules: [] })
  })

  it('checks Reel title timing and length from the montage spec', () => {
    const dir = makePackage('reel-titles', {
      'caption.txt': CLEAN_CAPTION,
      'spec.json': JSON.stringify({ segments: [
        { text: 'Касина-Велька: круг 11,5 км', dur: 1.2 },
        { text: 'Касина-Велька: круг 11,5 км', dur: 1.8 },
        { text: 'Вода почти чёрная из-за торфа и тени от леса', dur: 2 },
      ] }),
    })
    const { status, hits } = lint(dir)
    expect(status).toBe(1)
    expect(hits.map((h: { rule: string; source: string }) => `${h.rule} ${h.source}`)).toEqual([
      'F2 spec.json титр 02',
      'F2 spec.json титр 02',
    ])
  })

  it('finds Reel titles in build/spec.json lists and t ranges, and flags a Reel with no titles to check', () => {
    const listed = makePackage('reel-build-list', { 'caption.txt': CLEAN_CAPTION, 'reel.mp4': '' })
    fs.mkdirSync(path.join(listed, 'build'))
    fs.writeFileSync(path.join(listed, 'build', 'spec.json'), JSON.stringify([
      { src: 'a.MOV', dur: 1.2, text: 'Касина-Велька: круг 11,5 км' },
    ]))
    const ranged = makePackage('reel-t-range', {
      'caption.txt': CLEAN_CAPTION,
      'spec.json': JSON.stringify({ format: 'reel', segments: [{ t: '0.0-1.5', text: 'Касина-Велька: круг 11,5 км' }] }),
    })
    const bare = makePackage('reel-no-titles', { 'caption.txt': CLEAN_CAPTION, 'reel.mp4': '' })
    for (const dir of [listed, ranged]) {
      expect(lint(dir).hits.map((h: { rule: string; source: string }) => `${h.rule} ${h.source}`))
        .toContain('F2 spec.json титр 01')
    }
    expect(lint(bare).hits).toContainEqual(expect.objectContaining({ rule: 'F2', source: 'reel.mp4' }))
  })

  it('requires a section 18 checklist line per V/F number in package.md', () => {
    const missing = makePackage('checklist-missing', {
      'caption.txt': CLEAN_CAPTION,
      'package.md': 'Чек-лист V1–V11, F1–F13 (раздел 18)\n- V2/V3: сначала предмет\n- V1 да\n',
    })
    const { status, hits } = lint(missing)
    expect(status).toBe(1)
    expect(hits).toEqual([
      expect.objectContaining({ rule: 'R16', source: 'package.md' }),
      expect.objectContaining({ rule: 'R18', source: 'package.md' }),
    ])
    expect(hits[1].message).toMatch(/нет строк: V2, V3, V4, .*F13$/)

    const inline = makePackage('checklist-inline', {
      'caption.txt': CLEAN_CAPTION,
      'package.md': [
        '- **Состав поездки**: мы с Сергеем и Тимом',
        'V1 да (один порядок) · V2 да · V3 да · V4 да · V5 да · V6 да; V7 n/a · V11 да',
        '- V8 ✓ без клише',
        '- V9 2–4 предложения на слайд',
        '- V10 неприменимо (подборка).',
        'F1 да — место и число. F2 да. F3 да. F4 да — 1750 знаков. F5 да. F6 да. F7 да. F8 да.',
        '- F9 исключение Беларуси',
        '- F10 — не квест',
        '- F11 Reel: не Reel.',
        'F12 да · F13 — ·',
      ].join('\n'),
    })
    expect(lint(inline)).toMatchObject({ status: 0, rules: [] })

    fs.rmSync(path.join(inline, 'package.md'))
    expect(lint(inline).rules).toEqual(['R18'])
  })

  it('flags a trip told from «я» when the party line says «мы», unless lint-allow explains it (V3)', () => {
    const soloCaption = CLEAN_CAPTION.replace('мы с Сергеем поехали', 'я поехала')
    const dir = makePackage('voice-we', {
      'caption.txt': soloCaption,
      'story.md': 'Утром я стартовала с парковки, а потом мы шли лесом. Рассказываю по порядку.',
    })
    const first = lint(dir)
    expect(first.rules).toEqual(['V3', 'V3'])
    expect(first.hits.map((h: { source: string }) => h.source).sort()).toEqual(['caption.txt', 'story.md'])
    expect(first.hits[0].message).toMatch(/рассказан от «я»/)
    fs.appendFileSync(path.join(dir, 'package.md'), [
      '', 'lint-allow: V3 поехала — Юля ехала одна, Сергей встречал на месте',
      'lint-allow: V3 стартовала — то же', '',
    ].join('\n'))
    expect(lint(dir).rules).toEqual([])

    const solo = makePackage('voice-solo', {
      'caption.txt': soloCaption,
      'package.md': CHECKLIST.replace('мы с Сергеем', 'я одна'),
    })
    expect(lint(solo).rules).toEqual([])
  })

  it('flags carousel slides denser than 4 sentences or 50 body words (F2)', () => {
    const long = Array.from({ length: 51 }, (_, i) => `слово${i}`).join(' ') + '.'
    const dir = makePackage('dense', {
      'caption.txt': CLEAN_CAPTION,
      'spec.json': JSON.stringify({ slides: [
        { type: 'list', kicker: 'Старт', title: 'Парковка в Kolonia — длинный заголовок не считается', items: [long] },
        { type: 'list', title: 'Лес', text: 'Раз. Два. Три. Четыре. Пять.' },
        { type: 'list', title: 'Норма', text: 'Раз. Два. Три. Четыре.' },
        { type: 'map', title: 'Карта', points: [{ name: 'Kolonia' }, { name: 'Приют PTTK, 1290 м' }] },
      ] }),
    })
    const { rules, hits } = lint(dir)
    expect(rules).toEqual(['F2', 'F2'])
    expect(hits.map((h: { source: string }) => h.source)).toEqual(['spec.json слайд 01', 'spec.json слайд 02'])
    expect(hits[0].message).toMatch(/51 слов на слайде, предел 50/)
    expect(hits[1].message).toMatch(/5 предложений на слайде, предел 4/)
  })

  it('requires rights evidence even for otherwise clean packages', () => {
    const dir = makePackage('no-rights', { 'caption.txt': CLEAN_CAPTION })
    fs.rmSync(path.join(dir, 'rights.json'))
    expect(lint(dir)).toMatchObject({ status: 1, rules: ['R27'] })
  })

  it('rejects a call without a package folder', () => {
    expect(runCli('python3', [SCRIPT]).status).toBe(2)
  })
})
