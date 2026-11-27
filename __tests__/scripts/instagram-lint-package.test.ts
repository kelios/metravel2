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

  const CLEAN_STORY = 'Мы с Сергеем прошли этот круг вдвоём. Рассказываю по порядку, что мы увидели и почему вернулись.'

  const makePackage = (name: string, files: Record<string, string>) => {
    const dir = path.join(root, name)
    fs.mkdirSync(dir, { recursive: true })
    for (const [file, text] of Object.entries({ 'package.md': CHECKLIST, 'story.md': CLEAN_STORY, ...files })) {
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

  const sceneWords = (count: number, prefix: string) => Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`).join(' ')

  it('counts kicker, title and subtitle of one Reel scene together and does not duplicate a single title', () => {
    const short = makePackage('reel-scene-short', {
      'caption.txt': CLEAN_CAPTION,
      'spec.json': JSON.stringify({ segments: [
        { kicker: sceneWords(2, 'к'), text: sceneWords(5, 'з'), title: sceneWords(5, 'з'), subtitle: sceneWords(4, 'п'), dur: 3 },
        { text: 'Касина-Велька: круг 11,5 км', t0: null, t1: null, duration: 1.2 },
        { text: 'Касина-Велька: круг 11,5 км', dur: 1.8 },
      ] }),
    })
    const held = makePackage('reel-scene-held', {
      'caption.txt': CLEAN_CAPTION,
      'spec.json': JSON.stringify({ segments: [
        { kicker: sceneWords(2, 'к'), text: sceneWords(5, 'з'), subtitle: sceneWords(4, 'п'), dur: 4.8 },
      ] }),
    })
    const overlap = makePackage('reel-scene-overlap', {
      'caption.txt': CLEAN_CAPTION,
      'spec.json': JSON.stringify({ texts: [
        { t: '11.5-14.8', text: sceneWords(5, 'а') },
        { t: '11.5-14.8', subtitle: sceneWords(5, 'б') },
        { t: '32.2-35.2', kicker: sceneWords(2, 'в'), text: sceneWords(5, 'г'), subtitle: sceneWords(4, 'д') },
        { t: '28.6-32.2', text: sceneWords(6, 'е'), subtitle: sceneWords(5, 'ж') },
        { t: '35.2-38.8', text: sceneWords(5, 'з'), subtitle: sceneWords(4, 'и') },
        { t: '0.0-3.3', text: sceneWords(6, 'й'), subtitle: sceneWords(7, 'к') },
        { t: '3.3-6.6', text: sceneWords(7, 'л'), subtitle: sceneWords(7, 'м') },
      ] }),
    })
    const continued = makePackage('reel-scene-continued', {
      'caption.txt': CLEAN_CAPTION,
      'spec.json': JSON.stringify({ texts: [
        { t: '0-2', text: 'Касина-Велька: круг 11,5 км' },
        { t: '2-4', title: 'Касина-Велька: круг 11,5 км' },
      ] }),
    })
    const shortHits = lint(short).hits.filter((h: { rule: string }) => h.rule === 'F2')
    expect(shortHits).toHaveLength(1)
    expect(shortHits[0].message).toContain('11 слов')
    expect(shortHits[0].message).toContain('держится 3.0 с')
    expect(shortHits[0].message).toContain('нужно ≥ 4.8 с')
    expect(lint(held).hits.filter((h: { rule: string }) => h.rule === 'F2')).toEqual([])
    expect(lint(continued).hits.filter((h: { rule: string }) => h.rule === 'F2')).toEqual([])
    const overlapHits = lint(overlap).hits.filter((h: { rule: string }) => h.rule === 'F2')
    const messages = overlapHits.map((h: { message: string }) => h.message)
    expect(messages).toEqual(expect.arrayContaining([
      expect.stringContaining('11.5–14.8 с, 10 слов'),
      expect.stringContaining('32.2–35.2 с, 11 слов'),
      expect.stringContaining('28.6–32.2 с, 11 слов'),
      expect.stringContaining('35.2–38.8 с, 9 слов'),
      expect.stringContaining('0.0–3.3 с, 13 слов'),
      expect.stringContaining('3.3–6.6 с, 14 слов'),
    ]))
    expect(overlapHits).toHaveLength(6)
  })

  it('finds Reel titles in build/spec.json lists and t ranges, and flags a Reel with no titles to check', () => {
    const listed = makePackage('reel-build-list', {
      'caption.txt': CLEAN_CAPTION,
      'reel.mp4': '',
      'spec.json': JSON.stringify({ segments: [] }),
    })
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

  it('uses absolute timestamps for overlapping layers with durations and checks a continuous title length once', () => {
    const dir = makePackage('reel-partial-overlap', {
      'caption.txt': CLEAN_CAPTION,
      'spec.json': JSON.stringify({ texts: [
        { t0: 2, t1: 17, dur: 15, title: sceneWords(8, 'з') },
        { t0: 7, t1: 11, dur: 4, subtitle: sceneWords(4, 'п') },
      ] }),
    })
    const messages = lint(dir).hits.filter((h: { rule: string }) => h.rule === 'F2')
      .map((h: { message: string }) => h.message)
    expect(messages).toEqual([
      expect.stringContaining('8 слов, предел ~7'),
      expect.stringContaining('7.0–11.0 с, 12 слов, держится 4.0 с, нужно ≥ 5.1 с'),
    ])
  })

  it('flags zero and reversed explicit Reel intervals instead of silently passing them', () => {
    const dir = makePackage('reel-invalid-interval', {
      'caption.txt': CLEAN_CAPTION,
      'spec.json': JSON.stringify({ segments: [
        { t0: 3, t1: 3, text: 'Пустой интервал' },
        { t: '8-0', text: 'Обратный интервал' },
      ] }),
    })
    const { hits, status } = lint(dir)
    expect(status).toBe(1)
    expect(hits.filter((h: { rule: string }) => h.rule === 'F2')
      .map((h: { message: string }) => h.message)).toEqual([
      expect.stringContaining('неверный интервал 3.0–3.0 с'),
      expect.stringContaining('неверный интервал 8.0–0.0 с'),
    ])
  })

  const hasFfmpeg = runCli('sh', ['-c', 'command -v ffmpeg && command -v ffprobe']).status === 0
  ;(hasFfmpeg ? it : it.skip)('flags a silent Reel unless the owner-ordered silence is recorded (F11)', () => {
    const encode = (dir: string, audio: boolean) => {
      const result = runCli('ffmpeg', [
        '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:d=16',
        ...(audio ? ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-shortest', '-c:a', 'aac'] : []),
        '-c:v', 'mpeg4', path.join(dir, 'reel.mp4'),
      ])
      if (result.status !== 0) {
        throw new Error(`ffmpeg fixture generation failed (${result.status}): ${result.stderr}`)
      }
      expect(fs.statSync(path.join(dir, 'reel.mp4')).size).toBeGreaterThan(0)
    }
    const titles = JSON.stringify({ format: 'reel', segments: [{ text: 'Касина-Велька: круг 11,5 км', dur: 3 }] })
    const f11 = (dir: string) => lint(dir).hits.filter((h: { rule: string }) => h.rule === 'F11')
      .map((h: { message: string }) => h.message)
    const silent = makePackage('reel-silent', { 'caption.txt': CLEAN_CAPTION, 'spec.json': titles })
    encode(silent, false)
    expect(f11(silent)).toEqual([expect.stringContaining('Reel без звука')])
    const ordered = makePackage('reel-silent-ordered', {
      'caption.txt': CLEAN_CAPTION, 'spec.json': titles,
      'package.md': `${CHECKLIST}\nlint-allow: F11 тишина — владелец заказала ролик без звука 18.10`,
    })
    encode(ordered, false)
    expect(f11(ordered)).toEqual([])
    const voiced = makePackage('reel-music', { 'caption.txt': CLEAN_CAPTION, 'spec.json': titles })
    encode(voiced, true)
    expect(f11(voiced)).toEqual([])
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
        { type: 'story', kicker: 'Сцена', title: 'Гродно', body: long },
      ] }),
    })
    const { rules, hits } = lint(dir)
    expect(rules).toEqual(['F2', 'F2', 'F2'])
    expect(hits.map((h: { source: string }) => h.source))
      .toEqual(['spec.json слайд 01', 'spec.json слайд 02', 'spec.json слайд 05'])
    expect(hits[0].message).toMatch(/51 слов на слайде, предел 50/)
    expect(hits[1].message).toMatch(/5 предложений на слайде, предел 4/)
  })

  it('requires rights evidence even for otherwise clean packages', () => {
    const dir = makePackage('no-rights', { 'caption.txt': CLEAN_CAPTION })
    fs.rmSync(path.join(dir, 'rights.json'))
    expect(lint(dir)).toMatchObject({ status: 1, rules: ['R27'] })
  })

  it('flags a package built without story.md (template 18.1, check 4)', () => {
    const dir = makePackage('no-story', { 'caption.txt': CLEAN_CAPTION })
    fs.rmSync(path.join(dir, 'story.md'))
    expect(lint(dir)).toMatchObject({ status: 1, rules: ['S1'] })
  })

  it('flags «мы с Сергеем» repeated on several slides (V12)', () => {
    const dir = makePackage('sergei-repeat', {
      'caption.txt': CLEAN_CAPTION,
      'spec.json': JSON.stringify({ slides: [
        { type: 'e', title: 'Перевал', body: 'Мы с Сергеем вышли после обеда.' },
        { type: 'f', title: 'Спуск', body: 'Нам с Сергеем пришлось идти с фонарём.' },
      ] }),
    })
    expect(lint(dir)).toMatchObject({ status: 1, rules: ['V12'] })
  })

  it('rejects a call without a package folder', () => {
    expect(runCli('python3', [SCRIPT]).status).toBe(2)
  })
})
