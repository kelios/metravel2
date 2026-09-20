// #1998: скан глубины историй квеста ДО публикации (QUEST-CITY-LANDING-VALUE-001).
// Партия 19.09.2026 писалась историями в 1–2 предложения: дайджест детальной
// (2 предложения / 60 слов) забирал их целиком, хвоста для заметок города не
// оставалось, и 20 посадочных плюс 2 детальные ушли под `noindex, follow` —
// ни один скан семейства объём story не мерил, партия дошла до сборки прода.
const {
  detailPageWords,
  inspectQuest,
  parseArgs,
  scanQuests,
} = require('@/scripts/scan-quest-city-walk')
const { loadLocalBundles } = require('@/scripts/lib/questBundles')
const { MIN_QUEST_PAGE_WORDS } = require('@/scripts/lib/questPageDepth')
const { UsageError } = require('@/scripts/lib/cli-contract')

const INTRO =
  'В этом городе улицы помнят ремесленников, купцов и садовников, которые придумали домам характер. ' +
  'Прогулка проходит вдоль реки и через старую площадь, где каждое здание умеет рассказывать о себе без слов. ' +
  'Восемь остановок — восемь наблюдений о том, как город менялся и что от этого осталось на фасадах.'

const answer = (value: string) => ({ type: 'exact_any', value: JSON.stringify([value]) })
const step = (index: number, story: string) => ({
  id: 100 + index,
  step_id: `${index}-stop`,
  title: `Точка ${index}`,
  location: `Улица Ремесленная, ${index}`,
  story,
  task: 'Какое животное изображено над входом?',
  hint: 'Смотри выше двери.',
  answer_pattern: answer('грифон'),
  lat: 56.1 + index / 1000,
  lng: 24.1,
  is_intro: false,
  order: index,
})
const bundle = (stories: string[], over: Record<string, unknown> = {}) => ({
  id: 7,
  quest_id: 'demo-city-walk',
  title: 'Демо: прогулка по старому городу',
  city: { name: 'Демо' },
  intro: { step_id: 'intro', title: 'Начало', location: 'Демо', story: INTRO },
  steps: stories.map((story, index) => step(index + 1, story)),
  ...over,
})
const stories = (count: number, make: (index: number) => string) =>
  Array.from({ length: count }, (_, index) => make(index + 1))

// Партия 19.09: одно предложение — дайджест забирает его целиком.
const SHORT = (i: number) =>
  `Дом номер ${i} построен в конце девятнадцатого века на месте старого склада.`
// Целевая форма: два предложения дайджеста, дальше факты о месте для города.
const DEEP = (i: number) =>
  [
    `Дом номер ${i} построен в ${1880 + i} году по проекту городского архитектора и до сих пор держит угол квартала своим высоким щипцом.`,
    `Фасад дома ${i} собран из жёлтого кирпича с белыми поясами, а над входом сохранилась лепная рамка с датой постройки.`,
    `В ${1920 + i} году здесь открылась первая в квартале аптека, и её вывеска пережила три смены власти и один пожар.`,
    `Двор дома ${i} помнит колодец, вокруг которого до войны собирались торговцы с рыночной площади.`,
  ].join(' ')

describe('scan-quest-city-walk: замер одного квеста', () => {
  it('история в одно предложение: у города ноль заметок, детальная тоньше порога — две находки', () => {
    const result = inspectQuest(bundle(stories(8, SHORT)))
    expect(result).toMatchObject({ quest_id: 'demo-city-walk', quest_db_id: 7, steps: 8, places: 0, walkSentences: 0 })
    expect(result.detailWords).toBeLessThan(MIN_QUEST_PAGE_WORDS)
    expect(result.issues).toHaveLength(2)
    expect(result.issues[0]).toMatch(/ни одна из 8 точек/)
    expect(result.issues[1]).toMatch(new RegExp(`порог ${MIN_QUEST_PAGE_WORDS}`))
  })

  it('четыре предложения на точку: каждая точка даёт две заметки городу, детальная берёт порог', () => {
    const result = inspectQuest(bundle(stories(8, DEEP)))
    expect(result).toMatchObject({ steps: 8, places: 8, walkSentences: 16, otherPlaces: 0, issues: [] })
    expect(result.detailWords).toBeGreaterThanOrEqual(MIN_QUEST_PAGE_WORDS)
  })

  it('хвост есть, но точек мало — остаётся только находка про объём детальной', () => {
    const result = inspectQuest(bundle(stories(3, DEEP)))
    expect(result).toMatchObject({ steps: 3, places: 3 })
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toMatch(/слов прозы на детальной/)
  })

  it('порог детальной меряется тем же срезом, что пишет сборка: хвост историй в него не входит', () => {
    // Хвост (предложения 3–4) уходит на страницу города, а не в дайджест, —
    // поэтому детальная с хвостом и без него весит одинаково.
    const withTail = detailPageWords(bundle(stories(8, DEEP)))
    const digestOnly = detailPageWords(
      bundle(stories(8, (i) => DEEP(i).split('. ').slice(0, 2).join('. ') + '.')),
    )
    expect(withTail).toBe(digestOnly)
  })

  it('scanQuests оставляет в findings только квесты с находками', () => {
    const { results, findings } = scanQuests([
      bundle(stories(8, DEEP)),
      bundle(stories(8, SHORT), { quest_id: 'demo-short' }),
    ])
    expect(results).toHaveLength(2)
    expect(findings.map((finding: any) => finding.quest_id)).toEqual(['demo-short'])
  })

  it('эталонный data-файл (Казань) проходит — тот же путь, что и --source', () => {
    const { findings, results } = scanQuests(loadLocalBundles('scripts/kazan-zilant-syuyumbike-quest-data.js'))
    expect(results.length).toBeGreaterThan(0)
    expect(findings).toEqual([])
  })
})

describe('scan-quest-city-walk: CLI', () => {
  it('разбирает --source и --quest-id', () => {
    expect(parseArgs(['--source', 'scripts/x-quest-data.js'])).toMatchObject({ source: 'scripts/x-quest-data.js' })
    expect(parseArgs(['--quest-id=tartu-bridge-wish', '--json'])).toMatchObject({ questId: 'tartu-bridge-wish', json: true })
  })

  it('отказывается от опечатки в имени флага, а не обходит весь прод', () => {
    expect(() => parseArgs(['--sourse=scripts/x-quest-data.js'])).toThrow(UsageError)
  })
})
