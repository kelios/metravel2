/**
 * #2897: ссылка на страницу-источник ассистента — общий модуль экрана, клиента `ask`
 * и сервера `/ai/ask`; формат параметра роута задаёт `utils/aiAssistantConfig.ts`.
 */
import { formatSourceRef, leavesPage, leftPageSources, pageSources, parseSourceRef, pinSourceFirst } from '@/api/aiAssist/sourceRef'
import { namedDestinations, namedPlaces } from '@/api/aiAssist/topicGate'
import type { AiSource } from '@/api/aiAssist/types'
import { buildAssistantSourceHref } from '@/utils/aiAssistantConfig'

const card = (type: AiSource['type'], id: string, url = `https://metravel.by/${type}s/${id}`): AiSource => ({
  type,
  source_id: id,
  title: `${type} ${id}`,
  url,
  path: new URL(url).pathname,
  snippet: '',
  score: 1,
})

describe('aiAssist sourceRef (#2897)', () => {
  it('разбирает параметр роута и объект тела /ai/ask; мусор — null', () => {
    expect(parseSourceRef('travel:816')).toEqual({ type: 'travel', id: 816 })
    expect(parseSourceRef(' quest:12 ')).toEqual({ type: 'quest', id: 12 })
    expect(parseSourceRef(['quest:3', 'travel:1'])).toEqual({ type: 'quest', id: 3 })
    expect(parseSourceRef({ type: 'travel', id: 816 })).toEqual({ type: 'travel', id: 816 })
    expect(parseSourceRef({ type: 'quest', id: '7' })).toEqual({ type: 'quest', id: 7 })
    for (const bad of ['travel', 'travel:', 'book:1', 'travel:0', 'travel:-1', 'travel:1.5', 'travel:1e3', '', null, undefined, 816, { type: 'travel' }, { type: 'quest', id: 'x' }, { type: 'travel', id: 0 }]) {
      expect(parseSourceRef(bad)).toBeNull()
    }
  })

  it('ссылка со страницы и разбор роута — один формат', () => {
    const href = buildAssistantSourceHref({ type: 'travel', id: 816 })
    expect(href).toBe('/assistant?source=travel:816')
    const param = new URL(href, 'https://metravel.by').searchParams.get('source')
    expect(parseSourceRef(param)).toEqual({ type: 'travel', id: 816 })
    expect(formatSourceRef({ type: 'quest', id: 5 })).toBe('quest:5')
  })

  it('закреплённая карточка первой, без дубля по type:source_id, в пределах лимита', () => {
    const pinned = card('quest', '1', 'https://metravel.by/quests/1-pl')
    const found = [card('travel', '816'), card('quest', '1'), card('travel', '761')]
    expect(pinSourceFirst(pinned, found, 8).map((s) => `${s.type}:${s.source_id}`)).toEqual(['quest:1', 'travel:816', 'travel:761'])
    // фрагмент подбора той же страницы подобран под вопрос — он вместо закреплённой карточки
    expect(pinSourceFirst(pinned, found, 8)[0].url).toBe('https://metravel.by/quests/1')
    expect(pinSourceFirst(pinned, [card('travel', '816'), card('travel', '761'), card('travel', '790')]).map((s) => s.source_id)).toEqual(['1', '816', '761'])
    expect(pinSourceFirst(null, [card('travel', '816')]).length).toBe(1)
    expect(pinSourceFirst(pinned, found, 2).map((s) => s.source_id)).toEqual(['1', '816'])
    expect(pinSourceFirst(null, found, 2)).toEqual(found.slice(0, 2))
  })
})

// #3290: режим страницы — вопрос со страницы отвечается по ней, соседние материалы стоят отдельной группой.
describe('aiAssist sourceRef: режим страницы (#3290)', () => {
  const PAGE_TEXT = 'Рождественские ярмарки Польши 2026: Краков, Вроцлав, Гданьск. Польша. ярмарки открываются в конце ноября на рынке Кракова'

  it('источники хода: страница — группа page, найденное подбором — группа nearby без дубля страницы и в пределах лимита', () => {
    const page = card('travel', '816')
    const found = [card('travel', '700'), card('travel', '816', 'https://metravel.by/travels/816-dup'), card('quest', '1'), card('travel', '701'), card('travel', '702')]
    const sources = pageSources(page, found)
    expect(sources.map((s) => [`${s.type}:${s.source_id}`, s.group])).toEqual([['travel:816', 'page'], ['travel:700', 'nearby'], ['quest:1', 'nearby'], ['travel:701', 'nearby']])
    expect(pageSources(page, found, 1).map((s) => s.source_id)).toEqual(['816', '700'])
    expect(pageSources(page, []).map((s) => s.group)).toEqual(['page'])
    // Исходные карточки не меняются: группа ставится копии.
    expect(page.group).toBeUndefined()
    expect(found[0].group).toBeUndefined()
  })

  it('вопрос уводит со страницы, только когда названного места на ней нет', () => {
    expect(leavesPage('А что посмотреть в Гродно?', PAGE_TEXT)).toBe(true)
    expect(leavesPage('And what about Riga?', PAGE_TEXT)).toBe(true)
    // Место есть на странице — в любом падеже с обеих сторон.
    expect(leavesPage('Есть ли парковка у ярмарки в Гданьске?', PAGE_TEXT)).toBe(false)
    expect(leavesPage('Сколько ехать из Кракова?', PAGE_TEXT)).toBe(false)
    expect(leavesPage('Что есть под Вроцлавом?', PAGE_TEXT)).toBe(false)
    // Одно из названных мест на странице есть — вопрос о ней.
    expect(leavesPage('Как доехать из Кракова в Берлин?', PAGE_TEXT)).toBe(false)
    // Без названного места вопрос остаётся на странице.
    for (const question of ['Сколько дней занимает поездка и что взять с собой?', 'Подойдёт ли с детьми?', 'сколько это стоит в гродно', '']) {
      expect(leavesPage(question, PAGE_TEXT)).toBe(false)
    }
    // Название на другом письме на странице не узнаётся: такой вопрос идёт общим подбором.
    expect(leavesPage('Czy jest parking w Gdańsku?', PAGE_TEXT)).toBe(true)
    // Праздник и сервис после предлога — не место: такой вопрос режим страницы не снимает.
    for (const question of ['Что там открыто на Новый год?', 'А в Рождество ярмарка работает?', 'Есть фото из Instagram?', 'What is open on Christmas?']) {
      expect({ question, left: leavesPage(question, PAGE_TEXT) }).toEqual({ question, left: false })
    }
    expect(namedPlaces('Что открыто на Новый год в Гродно?')).toEqual(['Гродно'])
    expect(namedPlaces('А про Брест и в Риге?')).toEqual(['Брест', 'Риге'])
    // Места после предлога «где» — подмножество: предлог темы («про Брест») сюда не входит.
    expect(namedDestinations('А про Брест и в Риге?')).toEqual(['Риге'])
    expect(leavesPage('Czy jest parking w Gdańsku?', `${PAGE_TEXT} Gdańsk`)).toBe(false)
  })

  it('#3290: вопрос уводит со страницы — общий подбор, карточка страницы последней группой nearby; найденная подбором страница не дублируется', () => {
    const travel = (id: string, group?: AiSource['group']): AiSource => ({ type: 'travel', source_id: id, title: `Статья ${id}`, url: `https://metravel.by/travels/${id}`, path: `/travels/${id}`, snippet: '', score: 1, ...(group ? { group } : {}) })
    const page = travel('153')
    const found = [travel('22', 'match'), travel('178', 'match'), travel('500', 'nearby')]
    expect(leftPageSources(page, found).map((s) => [s.source_id, s.group])).toEqual([['22', 'match'], ['178', 'match'], ['500', 'nearby'], ['153', 'nearby']])
    // Подбор сам нашёл страницу: она остаётся его карточкой на своём месте.
    const withPage = [travel('22'), travel('153')]
    expect(leftPageSources(page, withPage)).toEqual(withPage)
    expect(leftPageSources(page, []).map((s) => [s.source_id, s.group])).toEqual([['153', 'nearby']])
  })
})
