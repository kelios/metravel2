// Единый гейт data-файла квеста (`npm run quest:gates -- --source=…`).
//
// До него конвейером волн был gitignored `.codex-temp/quests-plan/gates.sh`,
// а самоутечку в story, долю проверяемых шагов, короткие ответы-подстроки и
// alias нового города не проверял ни один трекаемый инструмент (ревью
// контент-агентов 11.10.2026). Тест держит именно эти четыре проверки и состав
// внешних гейтов: новый `scan-quest-*.js` входит сам, сетевой скан с
// `--offline` пропускается явно, а не зеленеет.
const fs = require('fs')
const path = require('path')

const {
  answerVariants,
  buildCommands,
  checkCheckableShare,
  checkCityAlias,
  checkSelfLeak,
  checkShortSubstring,
  evaluateRoute,
  parseArgs,
  sitemapQuestAliases,
} = require('@/scripts/quest-gates')
const { UsageError } = require('@/scripts/lib/cli-contract')

type Step = Record<string, unknown>

const exactAny = (list: string[]) => ({ type: 'exact_any', value: JSON.stringify(list) })
const free = { type: 'any_text', value: JSON.stringify({ min_length: 4 }) }

const step = (id: string, over: Step = {}): Step => ({
  step_id: id,
  title: '',
  location: '',
  story: '',
  task: '',
  hint: '',
  answer_pattern: exactAny([`ответ${id}`]),
  ...over,
})

const quest = (steps: Step[], over: Record<string, unknown> = {}) => ({
  quest_id: 'minsk-test',
  title: 'Минск: тест',
  city: { name: 'Минск' },
  meta: { tags: ['citywalk'] },
  intro: { title: 'Интро', story: '', task: '', location: '' },
  steps,
  ...over,
})

const eightCheckable = () => Array.from({ length: 8 }, (_, i) => step(`s${i + 1}`))

describe('answerVariants', () => {
  it('разбирает exact_any строкой JSON и массивом, exact — одной строкой', () => {
    expect(answerVariants(exactAny(['лев', 'львы']))).toEqual(['лев', 'львы'])
    expect(answerVariants({ type: 'exact_any', value: ['лев'] })).toEqual(['лев'])
    expect(answerVariants({ type: 'exact', value: '1848' })).toEqual(['1848'])
    expect(answerVariants(free)).toEqual([])
  })
})

describe('checkSelfLeak — ответ целым словом в тексте своего шага или в story соседа', () => {
  it('ловит ответ в story своего шага (кейс «силуэты»)', () => {
    const q = quest([step('a', { story: 'Различимы два природных силуэта: силуэты гор.', answer_pattern: exactAny(['силуэты']) })])
    expect(checkSelfLeak(q)).toEqual([{ step_id: 'a', where: 'story', answer: 'силуэты' }])
  })

  it('ловит ответ в задании и в story соседнего шага', () => {
    const q = quest([
      step('a', { story: 'Здесь стоял лев.' }),
      step('b', { task: 'Кто держит щит — лев?', answer_pattern: exactAny(['лев']) }),
    ])
    expect(checkSelfLeak(q).map((f: { where: string }) => f.where).sort()).toEqual(['story шага a', 'task'])
  })

  it('сравнивает с нормализацией рантайма: і/и и дефис против пробела', () => {
    const q = quest([
      step('a', { story: 'Вежа над Санкт-Петербургской дорогой, побач — ліс.', answer_pattern: exactAny(['лис']) }),
      step('b', { story: 'Дорога ведёт в Санкт-Петербург.', answer_pattern: exactAny(['санкт петербург']) }),
    ])
    expect(checkSelfLeak(q).map((f: { step_id: string; where: string }) => `${f.step_id}:${f.where}`)).toEqual(['a:story', 'b:story'])
  })

  it('не путает ответ с подстрокой чужого слова: «лев» в «слева» — не утечка', () => {
    const q = quest([step('a', { story: 'Слева — ратуша, справа — костёл.', answer_pattern: exactAny(['лев']) })])
    expect(checkSelfLeak(q)).toEqual([])
  })

  it('range: число из диапазона в тексте своего шага — утечка, за диапазоном — нет', () => {
    const range = { type: 'range', value: JSON.stringify({ min: 7, max: 9 }) }
    expect(checkSelfLeak(quest([step('a', { story: 'На фасаде 8 колонн.', answer_pattern: range })]))).toHaveLength(1)
    expect(checkSelfLeak(quest([step('a', { story: 'Построено в 1880 году.', answer_pattern: range })]))).toEqual([])
    expect(checkSelfLeak(quest([step('a', { story: 'Колонн 8-9 по фасаду.', answer_pattern: range })]))).toHaveLength(2)
  })
})

describe('checkCheckableShare — урок зимней волны', () => {
  it('8 точек и 8 проверяемых — зелёный', () => {
    expect(checkCheckableShare(quest(eightCheckable())).problems).toEqual([])
  })

  it('меньше 6 проверяемых и больше 3 any_text среди обязательных — красный', () => {
    const steps = eightCheckable().map((s, i) => (i < 4 ? { ...s, answer_pattern: free } : s))
    const share = checkCheckableShare(quest(steps))
    expect(share.checkable).toBe(4)
    expect(share.problems.join(' ')).toMatch(/проверяемых обязательных шагов 4 < 6/)
    expect(share.problems.join(' ')).toMatch(/any_text среди обязательных 4 > 3/)
  })

  it('привал «по желанию» не входит в обязательные, но считается точкой', () => {
    const steps = [...eightCheckable().slice(0, 7), step('cafe', { point_role: 'optional', answer_pattern: free })]
    const share = checkCheckableShare(quest(steps))
    expect(share.steps).toBe(8)
    expect(share.required).toBe(7)
    expect(share.problems).toEqual([])
  })

  it('меньше 8 точек у взрослого — «статья, не квест»; детский 5-7 — пол 6 и без доли', () => {
    expect(checkCheckableShare(quest(eightCheckable().slice(0, 7))).problems.join(' ')).toMatch(/статья, не квест/)
    const kids = quest(eightCheckable().slice(0, 6).map((s) => ({ ...s, answer_pattern: free })), {
      meta: { tags: ['kids', 'age-5-7'] },
    })
    expect(checkCheckableShare(kids).problems).toEqual([])
  })
})

describe('checkShortSubstring — короткий ответ внутри чужого слова', () => {
  it('ловит «три» внутри «осмотрись» в интро и «лев» внутри «слева» в location своего шага', () => {
    const q = quest(
      [step('a', { answer_pattern: exactAny(['три', '3']) }), step('b', { location: 'Слева от ратуши', answer_pattern: exactAny(['лев', 'львы']) })],
      { intro: { title: 'Интро', story: 'Осмотрись у фонтана.', task: '', location: '' } },
    )
    const hits = checkShortSubstring(q).map((f: { answer: string; host: string }) => `${f.answer}:${f.host}`)
    expect(hits).toEqual(['три:осмотрись', 'лев:слева'])
  })

  it('не трогает числа короче 3 цифр, словоформы и длинные ответы', () => {
    const q = quest(
      [step('a', { location: 'ул. Ленина, 25', hint: 'Перед валом', answer_pattern: exactAny(['2', 'вал', 'якорь']) })],
      { intro: { title: 'Интро', story: 'Сбор 25 декабря у вала.', task: '', location: '' } },
    )
    expect(checkShortSubstring(q)).toEqual([])
  })

  it('число из 3 цифр внутри чужого числа — мина: скан сравнивает словарь подстрокой и для чисел', () => {
    const q = quest(
      [step('a', { hint: 'Отсчитай 1200 м от ворот', answer_pattern: exactAny(['120']) })],
      { intro: { title: 'Интро', story: 'В 120 шагах от ворот.', task: '', location: '' } },
    )
    expect(checkShortSubstring(q).map((f: { answer: string; host: string }) => `${f.answer}:${f.host}`)).toEqual(['120:1200'])
  })

  it('нормализует текст как скан и рантайм: «эра» внутри «Сфера» (э → е)', () => {
    const q = quest([step('a', { answer_pattern: exactAny(['эра']) })], {
      intro: { title: 'Интро', story: 'Сфера над входом.', task: '', location: '' },
    })
    expect(checkShortSubstring(q)).toEqual([expect.objectContaining({ answer: 'эра', host: 'сфера' })])
  })
})

describe('checkCityAlias — #2209', () => {
  const catalog = [
    { quest_id: 'minsk-cipher', city_id: '4', city_name: 'Минск', city_alias: 'minsk' },
    { quest_id: 'veliky-novgorod-sadko', city_id: '184', city_name: 'Великий Новгород', city_alias: 'veliky-novgorod' },
  ]
  const sitemap = new Set(['minsk', 'veliky-novgorod'])

  it('новый квест существующего города сохраняет его alias', () => {
    const result = checkCityAlias({ quest_id: 'minsk-winter-star', city: { name: 'Минск' } }, catalog, sitemap)
    expect(result).toMatchObject({ predicted: 'minsk', existing: true, problems: [] })
  })

  it('квест, перебивающий alias многословного города, — красный', () => {
    const result = checkCityAlias({ quest_id: 'veliky-legends', city: { name: 'Великий Новгород' } }, catalog, sitemap)
    expect(result.problems.join(' ')).toMatch(/меняет alias/)
  })

  it('новый многословный город с quest_id из одного слова имени — красный', () => {
    const result = checkCityAlias({ quest_id: 'nizhny-chkalov', city: { name: 'Нижний Новгород' } }, catalog, sitemap)
    expect(result.problems.join(' ')).toMatch(/многословный город/)
    const ok = checkCityAlias({ quest_id: 'nizhny-novgorod-chkalov', city: { name: 'Нижний Новгород' } }, catalog, sitemap)
    expect(ok).toMatchObject({ predicted: 'nizhny-novgorod', problems: [] })
  })

  it('новый город не занимает чужой alias из sitemap; offline проверяет только форму', () => {
    const taken = checkCityAlias({ quest_id: 'minsk-region-lakes', city: { name: 'Минский район' } }, catalog, sitemap)
    expect(taken.problems.join(' ')).toMatch(/уже занят/)
    expect(checkCityAlias({ quest_id: 'minsk-winter', city: { name: 'Минск' } }, null, null).problems).toEqual([])
  })

  it('sitemapQuestAliases берёт только посадочные городов', () => {
    const xml = '<loc>https://metravel.by/quests/minsk</loc><loc>https://metravel.by/quests/minsk/minsk-cipher</loc><loc>https://metravel.by/travels/x</loc>'
    expect([...sitemapQuestAliases(xml)]).toEqual(['minsk'])
  })
})

describe('evaluateRoute', () => {
  const report = (route: Record<string, unknown>) => ({ reports: [{ quest_id: 'q', route }] })
  const len = (over: Record<string, unknown> = {}) => ({ total_m: 5200, max_route_m: 4000, max_leg_m: 1200, max_leg: { m: 900 }, over_route: true, over_leg: false, ...over })

  it('возврат и превышение бюджета — красный, roadtrip бюджет не меряет', () => {
    expect(evaluateRoute(report({ backtracks: [{}], length: len({ over_route: false }) }), [{ quest_id: 'q' }])).toHaveLength(1)
    expect(evaluateRoute(report({ backtracks: [], length: len() }), [{ quest_id: 'q', meta: { tags: [] } }])).toHaveLength(1)
    expect(evaluateRoute(report({ backtracks: [], length: len() }), [{ quest_id: 'q', meta: { tags: ['roadtrip'] } }])).toEqual([])
  })
})

describe('buildCommands — состав внешних гейтов', () => {
  const src = '.codex-temp/quests-plan/x/x-quest-data.js'

  it('каждый scan-quest-*.js с диска идёт с --source и тем же baseline, что у check:fast', () => {
    const scans = fs.readdirSync(path.join(process.cwd(), 'scripts')).filter((f: string) => /^scan-quest-.+\.js$/.test(f))
    const commands = buildCommands(src)
    for (const file of scans) {
      const cmd = commands.find((c: { name: string }) => c.name === file.replace(/\.js$/, ''))
      expect(cmd?.args).toContain(`--source=${src}`)
    }
    const hint = commands.find((c: { name: string }) => c.name === 'scan-quest-hint-leak')
    expect(hint.args).toContain('--baseline=scripts/quest-hint-leak-baseline.json')
    const names = commands.map((c: { name: string }) => c.name)
    expect(names[0]).toBe('migrate --dry-run')
    expect(names).toEqual(expect.arrayContaining(['scan-content-sources', 'geocheck --route-only']))
  })

  it('--offline пропускает сетевой prod-drift явно, а не выбрасывает его', () => {
    const drift = buildCommands(src, { offline: true }).find((c: { name: string }) => c.name === 'scan-quest-prod-drift')
    expect(drift).toMatchObject({ skip: expect.any(String) })
  })
})

describe('parseArgs', () => {
  it('без --source и с опечаткой во флаге — UsageError', () => {
    expect(() => parseArgs([])).toThrow(UsageError)
    expect(() => parseArgs(['--source=x.js', '--ofline'])).toThrow(UsageError)
    expect(parseArgs(['--source=x.js', '--max-route-m=3500'])).toMatchObject({ source: 'x.js', maxRouteM: 3500 })
  })
})
