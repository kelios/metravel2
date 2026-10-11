const fs = require('fs')
const path = require('path')
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

describe('instagram lint-package', () => {
  const root = makeTempDir('ig-lint-')
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

  const makePackage = (name: string, files: Record<string, string>) => {
    const dir = path.join(root, name)
    fs.mkdirSync(dir, { recursive: true })
    for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), text)
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
      'slides.txt': 'Все кадры в подборке зимние (данные на 11.10.2026)\n',
    })
    const { status, rules } = lint(dir)
    expect(status).toBe(1)
    expect(new Set(rules)).toEqual(new Set(['F3', 'F4', 'F5', 'F8', 'V3', 'V6', 'V8']))
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

    const allowed = makePackage('quest-allowed', {
      ...files,
      'package.md': 'lint-allow: F10 нептуна — название фонтана на маршруте, задание о другом\n',
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

  it('rejects a call without a package folder', () => {
    expect(runCli('python3', [SCRIPT]).status).toBe(2)
  })
})
