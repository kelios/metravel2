// #1447: общая загрузка бандлов квестов для аудит-скриптов.
//
// Инструменты поверх этого модуля существуют ради ответа «нарушений нет».
// Если обход каталога однажды снова возьмёт только первую страницу (а
// `page_size` на этом API кламится — `/api/quest-steps/?page_size=1000`
// отдаёт 100 строк при count 1299), скан отчитается зелёным по неполной базе.
// Этот тест падает, если пагинацию потеряют.
jest.mock('@/scripts/lib/fetchJson', () => ({ fetchJson: jest.fn() }))

const { fetchJson } = require('@/scripts/lib/fetchJson')
const { fetchAllQuestIds, fetchQuestBundles, loadLocalBundles, parseSteps } = require('@/scripts/lib/questBundles')

beforeEach(() => {
  ;(fetchJson as jest.Mock).mockReset()
})

describe('fetchAllQuestIds — обход страниц каталога', () => {
  it('идёт по next до конца, а не читает первую страницу', async () => {
    ;(fetchJson as jest.Mock)
      .mockResolvedValueOnce({ results: [{ quest_id: 'a' }, { quest_id: 'b' }], next: '/api/quests/?page=2' })
      .mockResolvedValueOnce({ results: [{ quest_id: 'c' }], next: null })

    await expect(fetchAllQuestIds('https://metravel.by')).resolves.toEqual(['a', 'b', 'c'])
    expect((fetchJson as jest.Mock).mock.calls.map((c: string[]) => c[0])).toEqual([
      'https://metravel.by/api/quests/',
      'https://metravel.by/api/quests/?page=2',
    ])
  })

  it('понимает и второй конверт списка — data/next_page_url с абсолютной ссылкой', async () => {
    ;(fetchJson as jest.Mock)
      .mockResolvedValueOnce({ data: [{ quest_id: 'a' }], next_page_url: 'https://metravel.by/api/quests/?page=2' })
      .mockResolvedValueOnce({ data: [{ quest_id: 'b' }] })

    await expect(fetchAllQuestIds('https://metravel.by')).resolves.toEqual(['a', 'b'])
  })

  it('зацикленный next не уводит обход в бесконечность', async () => {
    ;(fetchJson as jest.Mock).mockResolvedValue({ results: [{ quest_id: 'a' }], next: '/api/quests/' })

    await expect(fetchAllQuestIds('https://metravel.by')).resolves.toEqual(['a'])
    expect(fetchJson).toHaveBeenCalledTimes(1)
  })
})

describe('fetchQuestBundles', () => {
  it('один quest_id не тянет весь каталог', async () => {
    ;(fetchJson as jest.Mock).mockResolvedValueOnce({ id: 126, quest_id: 'krakow-bike-pradnik', steps: [] })

    const bundles = await fetchQuestBundles('https://metravel.by/', 'krakow-bike-pradnik')
    expect(bundles).toHaveLength(1)
    expect(fetchJson).toHaveBeenCalledTimes(1)
    expect((fetchJson as jest.Mock).mock.calls[0][0]).toBe(
      'https://metravel.by/api/quests/by-quest-id/krakow-bike-pradnik/',
    )
  })
})

describe('parseSteps', () => {
  it('принимает и массив, и JSON-строку, и не фильтрует intro сам', () => {
    expect(parseSteps({ steps: [{ step_id: 'a' }] })).toEqual([{ step_id: 'a' }])
    expect(parseSteps({ steps: '[{"step_id":"a","is_intro":true}]' })).toEqual([{ step_id: 'a', is_intro: true }])
    expect(parseSteps({ steps: '' })).toEqual([])
  })
})

describe('loadLocalBundles', () => {
  it('несуществующий quest_id — это ошибка, а не пустой (зелёный) результат', () => {
    expect(() => loadLocalBundles('scripts/sofia-quest-data.js', 'нет-такого')).toThrow(/нет-такого/)
  })

  it('отдаёт ту же форму, что и API-ветка', () => {
    const [bundle] = loadLocalBundles('scripts/sofia-quest-data.js', 'sofia-serdica-underfoot')
    expect(bundle.quest_id).toBe('sofia-serdica-underfoot')
    expect(Array.isArray(bundle.steps)).toBe(true)
    expect(bundle.steps.length).toBeGreaterThan(0)
  })
})
