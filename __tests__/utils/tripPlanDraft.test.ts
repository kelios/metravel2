/**
 * #3298, #3416 п.1: черновик маршрута для формы новой поездки — план ассистента в хранилище с коротким
 * идентификатором в адресе и одна точка материала параметром ссылки.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  buildTripPlanDraftHref,
  clearTripPlanDraft,
  loadTripPlanDraft,
  parseSourcePoint,
  saveTripPlanDraft,
  TRIP_PLAN_DRAFT_KEY,
  TRIP_PLAN_DRAFT_MAX_AGE_MS,
  TRIP_PLAN_DRAFT_MAX_DAY,
  TRIP_PLAN_DRAFT_MAX_POINTS,
  type TripPlanDraftInput,
} from '@/utils/tripPlanDraft'
import { buildTripPlanPrefillFromDraft, buildTripPlanRoutePrefill, draftRoutePoints } from '@/utils/tripPlanDraftIntake'
import { buildTripPlanCreateHrefFromQuest, formatSourcePoint } from '@/utils/tripPlanLinks'
import { isValidCoordinate } from '@/utils/coordinates'
import { MAX_ROUTE_DAY } from '@/utils/routePointDay'

const INPUT: TripPlanDraftInput = {
  title: 'Спланируй два дня в Кракове',
  description: 'Спланируй два дня в Кракове\nДень 1: «Квест по Кракову» (≈ 2 ч)\nДень 2: «Вокруг Кракова» (≈ 4 ч)',
  days: 2,
  points: [
    { type: 'quest', sourceId: 246, title: 'Квест по Кракову', lat: 50.054, lng: 19.935, day: 1, note: 'https://metravel.by/quests/246' },
    { type: 'travel', sourceId: 636, title: 'Вокруг Кракова', lat: 50.2, lng: 19.83, day: 2, note: 'https://metravel.by/travels/636' },
  ],
}

describe('черновик плана в хранилище (#3298)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
    jest.restoreAllMocks()
  })

  it('сохраняется под коротким идентификатором и читается по нему; в адресе формы — только идентификатор', async () => {
    const id = (await saveTripPlanDraft(INPUT))!
    expect(id).toMatch(/^[a-z0-9]{6,24}$/)
    const href = buildTripPlanDraftHref(id)
    expect(href).toBe(`/trips/plan/create?source=plan&draft=${id}`)
    // Вопрос посетителя и точки плана в адрес не попадают.
    expect(decodeURIComponent(href)).not.toMatch(/Краков|50\.054|quests/)
    const draft = (await loadTripPlanDraft(id))!
    expect(draft).toMatchObject({ id, title: INPUT.title, description: INPUT.description, days: 2 })
    expect(draft.points).toEqual(INPUT.points)
    // Чтение запись не удаляет: гость входит и возвращается в ту же форму.
    expect(await loadTripPlanDraft(id)).not.toBeNull()
  })

  it('чужой идентификатор, пустой и испорченная запись — черновика нет', async () => {
    const id = (await saveTripPlanDraft(INPUT))!
    expect(await loadTripPlanDraft('zzzzzzzz')).toBeNull()
    expect(await loadTripPlanDraft('')).toBeNull()
    expect(await loadTripPlanDraft(null)).toBeNull()
    await AsyncStorage.setItem(TRIP_PLAN_DRAFT_KEY, '{не json')
    expect(await loadTripPlanDraft(id)).toBeNull()
    await AsyncStorage.setItem(TRIP_PLAN_DRAFT_KEY, JSON.stringify({ id, createdAt: Date.now(), points: [] }))
    expect(await loadTripPlanDraft(id)).toBeNull()
  })

  it('живёт сутки: старше — не читается и удаляется', async () => {
    const id = (await saveTripPlanDraft(INPUT))!
    const now = Date.now()
    jest.spyOn(Date, 'now').mockReturnValue(now + TRIP_PLAN_DRAFT_MAX_AGE_MS + 1000)
    expect(await loadTripPlanDraft(id)).toBeNull()
    expect(await AsyncStorage.getItem(TRIP_PLAN_DRAFT_KEY)).toBeNull()
  })

  it('удаляется после создания поездки; чужой идентификатор запись не трогает', async () => {
    const id = (await saveTripPlanDraft(INPUT))!
    await clearTripPlanDraft('zzzzzzzz')
    expect(await loadTripPlanDraft(id)).not.toBeNull()
    await clearTripPlanDraft(id)
    expect(await loadTripPlanDraft(id)).toBeNull()
  })

  it('кривые точки отбрасываются, лишние обрезаются; без точек черновик не сохраняется', async () => {
    const points = [
      ...INPUT.points,
      { type: 'quest' as const, title: '', lat: 50, lng: 19 },
      { type: 'quest' as const, title: 'Без координат', lat: Number.NaN, lng: 19 },
      { type: 'quest' as const, title: 'За пределами', lat: 95, lng: 19 },
      { type: 'travel' as const, title: 'День не число', lat: 50.1, lng: 19.9, day: 0 },
    ]
    const draft = (await loadTripPlanDraft(await saveTripPlanDraft({ ...INPUT, points })))!
    expect(draft.points.map((point) => point.title)).toEqual(['Квест по Кракову', 'Вокруг Кракова', 'День не число'])
    expect(draft.points[2]).toMatchObject({ day: null, sourceId: null })
    const many = Array.from({ length: TRIP_PLAN_DRAFT_MAX_POINTS + 5 }, (_, index) => ({ type: 'quest' as const, title: `Точка ${index}`, lat: 50, lng: 19 }))
    expect((await loadTripPlanDraft(await saveTripPlanDraft({ ...INPUT, points: many })))!.points).toHaveLength(TRIP_PLAN_DRAFT_MAX_POINTS)
    expect(await saveTripPlanDraft({ ...INPUT, points: [] })).toBeNull()
  })

  it('владелец: свой черновик читается своим пользователем', async () => {
    const id = (await saveTripPlanDraft(INPUT, '42'))!
    expect((await loadTripPlanDraft(id, '42'))!.owner).toBe('42')
  })

  it('владелец: гостевой черновик принимает и гость, и вошедший после входа; запись без поля — гостевая', async () => {
    const id = (await saveTripPlanDraft(INPUT))!
    expect(await loadTripPlanDraft(id, null)).not.toBeNull()
    expect(await loadTripPlanDraft(id, '42')).not.toBeNull()
    const legacy = JSON.parse((await AsyncStorage.getItem(TRIP_PLAN_DRAFT_KEY))!)
    delete legacy.owner
    await AsyncStorage.setItem(TRIP_PLAN_DRAFT_KEY, JSON.stringify(legacy))
    expect(await loadTripPlanDraft(id, '7')).toMatchObject({ id, owner: null })
  })

  it('владелец: черновик одного вошедшего не принимается другим и гостем и удаляется', async () => {
    const id = (await saveTripPlanDraft(INPUT, '42'))!
    expect(await loadTripPlanDraft(id, '7')).toBeNull()
    expect(await AsyncStorage.getItem(TRIP_PLAN_DRAFT_KEY)).toBeNull()
    const again = (await saveTripPlanDraft(INPUT, '42'))!
    expect(await loadTripPlanDraft(again, null)).toBeNull()
    expect(await AsyncStorage.getItem(TRIP_PLAN_DRAFT_KEY)).toBeNull()
  })

  it('хранилище недоступно — идентификатора нет, ошибки тоже', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('quota'))
    expect(await saveTripPlanDraft(INPUT)).toBeNull()
  })
})

describe('точки черновика → точки маршрута (#3298, #3416 п.1)', () => {
  it('статья — «Место» с привязкой, квест — обычная точка; день и порядок сохраняются', () => {
    expect(draftRoutePoints(INPUT.points)).toEqual([
      { id: 'draft-quest-246-0', type: 'custom', name: 'Квест по Кракову', description: 'https://metravel.by/quests/246', coordinates: [19.935, 50.054], placeId: null, dayNumber: 1 },
      { id: 'draft-travel-636-1', type: 'place', name: 'Вокруг Кракова', description: 'https://metravel.by/travels/636', coordinates: [19.83, 50.2], placeId: 636, dayNumber: 2 },
    ])
  })

  it('подстановка формы из черновика: название, описание по дням и дата окончания по числу дней', () => {
    const draft = { ...INPUT, id: 'abc12345', createdAt: 1 }
    expect(buildTripPlanPrefillFromDraft(draft, '2026-12-05')).toEqual({ title: INPUT.title, description: INPUT.description, startDate: '2026-12-05', endDate: '2026-12-06' })
    expect(buildTripPlanPrefillFromDraft({ ...draft, days: 1 }, '2026-12-05')).not.toHaveProperty('endDate')
  })

  it('одна точка материала едет параметром ссылки: квест из ответа ассистента встаёт точкой маршрута', () => {
    const href = buildTripPlanCreateHrefFromQuest({ title: 'Квест по Гродно', url: 'https://metravel.by/quests/11/grodno-royal', description: 'Городской квест', lat: 53.6779, lng: 23.8293 })
    const params = Object.fromEntries(new URL(`https://metravel.by${href}`).searchParams.entries())
    expect(params.sourcePoint).toBe('53.67790,23.82930')
    expect(buildTripPlanRoutePrefill(params)).toEqual([
      { id: 'draft-quest-0-0', type: 'custom', name: 'Квест по Гродно', description: 'https://metravel.by/quests/11/grodno-royal', coordinates: [23.8293, 53.6779], placeId: null, dayNumber: null },
    ])
    // Без координат ссылка прежняя и точек нет.
    const plain = buildTripPlanCreateHrefFromQuest({ title: 'Квест по Гродно', url: 'https://metravel.by/quests/11/grodno-royal' })
    expect(plain).not.toContain('sourcePoint')
    expect(buildTripPlanRoutePrefill(Object.fromEntries(new URL(`https://metravel.by${plain}`).searchParams.entries()))).toEqual([])
    // Статья привязывается к месту по своему идентификатору.
    expect(buildTripPlanRoutePrefill({ source: 'travel', sourceTravelId: '816', sourceTravelTitle: 'Ярмарки', sourcePoint: '50.06,19.94' })[0]).toMatchObject({ type: 'place', placeId: 816 })
    // Чужой источник и кривые координаты точек не дают.
    expect(buildTripPlanRoutePrefill({ source: 'other', sourceTravelTitle: 'X', sourcePoint: '50,19' })).toEqual([])
    expect(buildTripPlanRoutePrefill({ source: 'quest', sourceTravelTitle: 'X', sourcePoint: '500,19' })).toEqual([])
    expect(buildTripPlanRoutePrefill({ source: 'quest', sourcePoint: '50,19' })).toEqual([])
    // Подпись точки из адреса — недоверенная: не http(s) не берётся, длинная обрезается.
    expect(buildTripPlanRoutePrefill({ source: 'quest', sourceTravelTitle: 'X', sourcePoint: '50,19', sourceTravelUrl: 'javascript:alert(1)' })[0].description).toBeNull()
    const long = `https://metravel.by/${'a'.repeat(5000)}`
    expect(buildTripPlanRoutePrefill({ source: 'quest', sourceTravelTitle: 'X', sourcePoint: '50,19', sourceTravelUrl: long })[0].description).toHaveLength(240)
  })

  it('координаты параметра: пять знаков, только числа в пределах', () => {
    expect(formatSourcePoint(50.0612345, 19.9371234)).toBe('50.06123,19.93712')
    expect(formatSourcePoint(null, 19)).toBe('')
    expect(formatSourcePoint(undefined, undefined)).toBe('')
    expect(formatSourcePoint(91, 19)).toBe('')
    expect(parseSourcePoint('50.06123,19.93712')).toEqual({ lat: 50.06123, lng: 19.93712 })
    expect(parseSourcePoint(['-33.9,18.4'])).toEqual({ lat: -33.9, lng: 18.4 })
    for (const value of ['', 'abc', '50', '50;19', '50,19,7', '95,19', '50,190', undefined]) expect(parseSourcePoint(value)).toBeNull()
  })
})

// 15.11.2026: статический импорт хранилища черновика из `utils/tripPlanLinks.ts` добавил странице статьи
// лишний eager-запрос (19 при потолке 18), и выкат остановил страж бюджета бандла.
describe('граф импортов: страница статьи не тянет черновик и маршрут поездки', () => {
  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')
  const importsOf = (file: string): string[] =>
    [...fs.readFileSync(path.join(__dirname, '../..', file), 'utf8').matchAll(/^import\s+(type\s+)?[^'"]*['"]([^'"]+)['"]/gm)].filter((match) => !match[1]).map((match) => match[2])

  it('сборка ссылки на форму поездки — без хранилища черновика и модулей маршрута', () => {
    expect(importsOf('utils/tripPlanLinks.ts').sort()).toEqual(['@/i18n', '@/utils/seo', '@/utils/travelSeo'])
  })

  it('хранилище черновика — только AsyncStorage: общий чанк экрана ассистента и формы не несёт код планировщика', () => {
    expect(importsOf('utils/tripPlanDraft.ts')).toEqual(['@react-native-async-storage/async-storage'])
  })

  it('приём точек грузит только форма новой поездки', () => {
    const users = ['app/(tabs)/trips/plan/create.tsx', 'components/travel/CTASection.tsx', 'components/screens/assistant/AssistantPlanDays.tsx', 'components/screens/assistant/AssistantSourceCards.tsx', 'hooks/usePlanTripFromSource.ts']
    expect(users.filter((file) => importsOf(file).includes('@/utils/tripPlanDraftIntake'))).toEqual(['app/(tabs)/trips/plan/create.tsx'])
    expect(importsOf('components/travel/CTASection.tsx')).not.toContain('@/utils/tripPlanDraft')
  })

  it('свои копии проверок совпадают с общими: потолок дня и пределы координат', () => {
    expect(TRIP_PLAN_DRAFT_MAX_DAY).toBe(MAX_ROUTE_DAY)
    for (const [lat, lng] of [[50.06, 19.94], [90, 180], [-90, -180], [90.01, 0], [0, 180.01], [Number.NaN, 0]] as Array<[number, number]>) {
      expect(parseSourcePoint(`${lat},${lng}`) !== null).toBe(isValidCoordinate(lat, lng))
      expect(formatSourcePoint(lat, lng) !== '').toBe(isValidCoordinate(lat, lng))
    }
  })
})

