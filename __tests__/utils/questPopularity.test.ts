/**
 * #1798: витрина квестов на главной и её серверный двойник обязаны отбирать
 * квесты одним правилом. Приложение получает порядок от бэкенда (`?sort=popular`),
 * SSR-проекция квестов (`scripts/lib/questWebProjection.js`, `discovery.preview`)
 * сортирует уже выкачанный каталог локально — значит правило должно жить в одном
 * месте и давать в обоих случаях один и тот же состав.
 */
import fs from 'node:fs'
import path from 'node:path'

const {
  POPULAR_QUEST_MIN_COMPLETIONS,
  POPULAR_QUEST_MIN_MATCHES,
  canRankQuestsByPopularity,
  compareQuestPopularity,
  countPopularQuests,
  selectPopularQuests,
  sortQuestsByPopularity,
} = require('@/utils/questPopularity')

type RawQuest = {
  id: number
  quest_id: string
  city_id: string
  title: string
  completions_count?: number
  views_count?: number
}

/**
 * Каталог намеренно перемешан по id и содержит все три случая ничьей:
 * равные прохождения при разных просмотрах, полное равенство до id и хвост
 * нулей — 16 квестов из 177 на проде имеют прохождения, остальные нули.
 */
const CATALOG: RawQuest[] = [
  { id: 3, quest_id: 'q3', city_id: '1', title: 'Q3', completions_count: 2, views_count: 14 },
  { id: 51, quest_id: 'q51', city_id: '1', title: 'Q51', completions_count: 2, views_count: 22 },
  { id: 8, quest_id: 'q8', city_id: '2', title: 'Q8', completions_count: 1, views_count: 14 },
  { id: 32, quest_id: 'q32', city_id: '2', title: 'Q32', completions_count: 3, views_count: 14 },
  { id: 13, quest_id: 'q13', city_id: '3', title: 'Q13', completions_count: 2, views_count: 14 },
  { id: 12, quest_id: 'q12', city_id: '3', title: 'Q12', completions_count: 1, views_count: 14 },
  { id: 5, quest_id: 'q5', city_id: '4', title: 'Q5', completions_count: 0, views_count: 9 },
  { id: 1, quest_id: 'q1', city_id: '4', title: 'Q1', completions_count: 0, views_count: 0 },
  { id: 2, quest_id: 'q2', city_id: '5', title: 'Q2', completions_count: 0, views_count: 0 },
  { id: 4, quest_id: 'q4', city_id: '5', title: 'Q4', completions_count: 0, views_count: 0 },
]

/** Порядок, который отдаёт бэкенд: `-completions_count`, `-views_count`, `id`. */
const POPULAR_ORDER = ['q32', 'q51', 'q3', 'q13', 'q8', 'q12', 'q5', 'q1', 'q2', 'q4']

/** Ровно то, что делает `fetchQuestsPreview` + срез компонента промо-блока. */
const HOME_PROMO_DESKTOP = 6
const HOME_PROMO_MOBILE = 4
/**
 * Размер витрины, которую публикует SSR-проекция: читается из самого исходника,
 * чтобы правка лимита там не прошла мимо этого теста.
 */
const SSR_FEATURED = (() => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'scripts/lib/questWebProjection.js'), 'utf8')
  const match = /preview: selectPopularQuests\(catalog, (\d+)\)/.exec(source)
  if (!match) throw new Error('discovery.preview в questWebProjection.js больше не строится через selectPopularQuests')
  return Number(match[1])
})()

/** Ровно то, что публикует SSR-проекция в `discovery.preview`. */
function ssrFeaturedSlugs(quests: RawQuest[]): string[] {
  return selectPopularQuests(quests, SSR_FEATURED).map((quest: RawQuest) => quest.quest_id)
}

describe('quest popularity rule', () => {
  it('ranks by completions, then views, then id — the backend ordering', () => {
    expect(sortQuestsByPopularity(CATALOG).map((quest) => quest.quest_id)).toEqual(POPULAR_ORDER)
  })

  it('leaves the caller array untouched', () => {
    const source = CATALOG.slice()
    sortQuestsByPopularity(source)
    expect(source.map((quest) => quest.id)).toEqual(CATALOG.map((quest) => quest.id))
  })

  it('treats missing counters as zero instead of dropping the quest', () => {
    const ranked = sortQuestsByPopularity([
      { id: 9, quest_id: 'bare' },
      { id: 2, quest_id: 'bare-older' },
      { id: 7, quest_id: 'played', completions_count: 1 },
    ] as RawQuest[])
    expect(ranked.map((quest) => quest.quest_id)).toEqual(['played', 'bare-older', 'bare'])
  })

  it('reads adapted camelCase metadata as well as the raw API shape', () => {
    const ranked = sortQuestsByPopularity([
      { id: 1, completionsCount: 0 },
      { id: 2, completionsCount: 4 },
    ] as any[])
    expect(ranked.map((quest) => quest.id)).toEqual([2, 1])
  })

  it('breaks a full tie by numeric id even when the catalog id is a slug', () => {
    // Адаптированная мета каталога: `id` — слаг, число живёт в `numericId`.
    // Порядок входа обратный ожидаемому, иначе тест прошёл бы на одной
    // стабильности сортировки, ничего не проверив.
    const ranked = sortQuestsByPopularity([
      { id: 'minsk-cipher', numericId: 32, completionsCount: 2, viewsCount: 15 },
      { id: 'barkovshchina-spirits', numericId: 3, completionsCount: 2, viewsCount: 15 },
    ] as any[])
    expect(ranked.map((quest) => quest.id)).toEqual(['barkovshchina-spirits', 'minsk-cipher'])
  })

  it('keeps a slug-only quest in place instead of sorting it by NaN', () => {
    const ranked = sortQuestsByPopularity([
      { id: 'no-number-first', completionsCount: 1 },
      { id: 'no-number-second', completionsCount: 1 },
    ] as any[])
    expect(ranked.map((quest) => quest.id)).toEqual(['no-number-first', 'no-number-second'])
  })

  it('keeps the block filled when nothing has been completed yet', () => {
    const flat = CATALOG.map((quest) => ({ ...quest, completions_count: 0, views_count: 0 }))
    expect(selectPopularQuests(flat, HOME_PROMO_DESKTOP)).toHaveLength(HOME_PROMO_DESKTOP)
  })

  it('returns the whole list when no limit is given', () => {
    expect(selectPopularQuests(CATALOG)).toHaveLength(CATALOG.length)
    expect(compareQuestPopularity(CATALOG[0], CATALOG[0])).toBe(0)
  })
})

/**
 * #1790: каталог предлагает сортировку «Популярные» только там, где она что-то
 * меняет. Порог считается по тем же полям, что и порядок, чтобы «популярное» в
 * каталоге и на главной значило одно и то же.
 */
describe('popularity threshold for the catalog sort', () => {
  it('counts only quests at or above the completions threshold', () => {
    // В CATALOG это q32 (3) и три квеста с двумя прохождениями.
    expect(POPULAR_QUEST_MIN_COMPLETIONS).toBe(2)
    expect(countPopularQuests(CATALOG)).toBe(4)
    expect(canRankQuestsByPopularity(CATALOG)).toBe(true)
  })

  it('does not offer the sort for a catalog nobody has completed', () => {
    const flat = CATALOG.map((quest) => ({ ...quest, completions_count: 0 }))
    expect(countPopularQuests(flat)).toBe(0)
    expect(canRankQuestsByPopularity(flat)).toBe(false)
  })

  it('ignores single completions — one walkthrough is not a signal', () => {
    const onesOnly = CATALOG.map((quest) => ({ ...quest, completions_count: 1 }))
    expect(canRankQuestsByPopularity(onesOnly)).toBe(false)
  })

  it('needs more than one popular quest to have something to reorder', () => {
    const single = CATALOG.map((quest, index) => ({
      ...quest,
      completions_count: index === 0 ? POPULAR_QUEST_MIN_COMPLETIONS : 0,
    }))
    expect(POPULAR_QUEST_MIN_MATCHES).toBe(2)
    expect(countPopularQuests(single)).toBe(1)
    expect(canRankQuestsByPopularity(single)).toBe(false)

    const pair = single.map((quest, index) => (
      index === 1 ? { ...quest, completions_count: POPULAR_QUEST_MIN_COMPLETIONS } : quest
    ))
    expect(canRankQuestsByPopularity(pair)).toBe(true)
  })

  it('reads the adapted camelCase catalog the screen actually holds', () => {
    const adapted = [
      { id: 'a', completionsCount: 2 },
      { id: 'b', completionsCount: 2 },
      { id: 'c', completionsCount: 0 },
    ]
    expect(countPopularQuests(adapted)).toBe(2)
    expect(canRankQuestsByPopularity(adapted)).toBe(true)
  })

  it('survives a missing catalog instead of throwing', () => {
    expect(countPopularQuests(undefined)).toBe(0)
    expect(canRankQuestsByPopularity(null)).toBe(false)
  })
})

describe('home promo and its SSR twin build one selection', () => {
  // Бэкенд отдаёт промо-блоку уже отсортированный срез — здесь это то же
  // правило, применённое к тому же каталогу.
  const serverPreview = selectPopularQuests(CATALOG, HOME_PROMO_DESKTOP)

  it('spells out the same popular quests in server HTML as the app requests', () => {
    expect(ssrFeaturedSlugs(CATALOG)).toEqual(POPULAR_ORDER.slice(0, SSR_FEATURED))
  })

  it('renders the app grid as a prefix of the static list, not a different set', () => {
    const featured = ssrFeaturedSlugs(CATALOG)
    const desktop = serverPreview.map((quest) => quest.quest_id)
    const mobile = desktop.slice(0, HOME_PROMO_MOBILE)

    expect(featured.slice(0, HOME_PROMO_DESKTOP)).toEqual(desktop)
    expect(featured.slice(0, HOME_PROMO_MOBILE)).toEqual(mobile)
  })

  it('no longer leads with the lowest ids', () => {
    // Регресс, ради которого заведена задача: раньше срез был `slice(0, 8)`
    // по каталогу в порядке id.
    expect(ssrFeaturedSlugs(CATALOG)[0]).not.toBe(
      CATALOG.slice().sort((a, b) => a.id - b.id)[0].quest_id,
    )
  })
})
