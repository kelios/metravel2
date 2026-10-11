// #2197: язык контента в модели квеста. Ответ без полей — `ru`; шаги и интро
// получают локаль бандла (поле шагам бэкенд не отдаёт), по ней #2196 выбирает
// правило проверки ответа.
import type { ApiQuestBundle, ApiQuestMeta } from '@/api/quests'
import { adaptBundle, adaptMeta, adaptStep } from '@/utils/questAdapters'
import { createQuestCatalogSearch } from '@/utils/questCatalogSearch'
import { buildQuestCityCatalog } from '@/screens/tabs/QuestsScreen.helpers'
import { buildQuestCityLandingGroups } from '@/utils/questCityAlias'

const step = (id: string, extra: Record<string, unknown> = {}) => ({
  id: Number(id.replace(/\D/g, '')) || 1,
  step_id: id,
  title: id,
  location: 'loc',
  story: 'story',
  task: 'task',
  answer_pattern: { type: 'exact', value: 'smok' },
  lat: 50,
  lng: 19,
  maps_url: '',
  ...extra,
})

describe('requested-locale city names independent of quest content (#2408)', () => {
  const russianKrakow = (extra: Partial<ApiQuestMeta> = {}) => meta({
    title: 'Русский маршрут',
    city_name: 'Краков',
    city_name_canonical: 'Краков',
    city_name_localized: 'Kraków',
    city_alias: 'krakow',
    country_code: 'PL',
    content_locale: 'ru',
    available_locales: ['ru'],
    ...extra,
  })

  it.each([false, true])('finds all Russian quests and one PL city chip (reversed=%s)', (reversed) => {
    const dtos = [
      russianKrakow({ quest_id: 'krakow-first', city_legacy_ids: [77] }),
      russianKrakow({ id: 2, quest_id: 'krakow-second', city_id: '2' }),
      russianKrakow({ id: 3, quest_id: 'warsaw-route', city_id: '3', city_name: 'Варшава',
        city_name_canonical: 'Варшава', city_name_localized: 'Warszawa', city_alias: 'warsaw' }),
    ]
    const adapted = (reversed ? dtos.reverse() : dtos).map(adaptMeta)
    const catalog = buildQuestCityCatalog(adapted)
    const search = createQuestCatalogSearch(adapted, catalog.canonicalCityIdById)
    for (const term of ['kraków', 'краков']) {
      expect(adapted.filter((quest) => search(quest, term)).map((quest) => quest.id).sort())
        .toEqual(['krakow-first', 'krakow-second'])
    }
    expect(catalog.cities.map((city) => city.name).sort()).toEqual(['Kraków', 'Warszawa'])
    expect(new Set(adapted.slice().filter((quest) => quest.cityName === 'Kraków')
      .map((quest) => catalog.canonicalCityIdById[quest.cityId])).size).toBe(1)
    expect(adapted.every((quest) => quest.contentLocale === 'ru')).toBe(true)
    expect(adapted.every((quest) => quest.availableLocales.join() === 'ru')).toBe(true)
    expect(buildQuestCityLandingGroups(adapted).find((group) => group.segment === 'krakow'))
      .toMatchObject({ cityName: 'Kraków', cityIds: expect.arrayContaining(['1', '2']), legacyCityIds: ['77'] })
  })

  it.each([undefined, '', '   ', 'Краков'])('preserves legacy/RU/backend city-translation fallback (%s)', (localized) => {
    const adapted = adaptMeta(russianKrakow({ city_name_localized: localized }))
    expect(adapted).toMatchObject({ cityName: 'Краков', cityNameCanonical: 'Краков', contentLocale: 'ru' })
    const catalog = buildQuestCityCatalog([adapted])
    expect(createQuestCatalogSearch([adapted], catalog.canonicalCityIdById)(adapted, 'краков')).toBe(true)
  })

  it('keeps content-name identity when a localized DTO has no canonical field', () => {
    const localized = adaptMeta(russianKrakow({ city_name_canonical: undefined }))
    const legacy = adaptMeta(russianKrakow({ city_id: '2', city_name_canonical: undefined, city_name_localized: undefined }))
    const catalog = buildQuestCityCatalog([localized, legacy])
    expect(localized.cityNameCanonical).toBe('Краков')
    expect(legacy.cityNameCanonical).toBeUndefined()
    expect(catalog.cities).toHaveLength(1)
  })

  it('uses requested-locale name in bundle and synthesized intro without translating steps', () => {
    const adapted = adaptBundle(bundle({
      city: { id: 1, legacy_ids: [77], name: 'Краков', name_localized: 'Kraków', name_canonical: 'Краков', lat: 50, lng: 19 },
      intro: null,
      content_locale: 'ru',
      available_locales: ['ru'],
    }))
    expect(adapted.city).toMatchObject({ id: 1, legacyIds: [77], name: 'Kraków', nameCanonical: 'Краков' })
    expect(adapted.intro).toMatchObject({ location: 'Kraków', contentLocale: 'ru' })
    expect(adapted.steps.map((item) => item.contentLocale)).toEqual(['ru', 'ru'])
    expect(adapted.availableLocales).toEqual(['ru'])
  })

  it.each([undefined, '', '   ', 'Краков'])('preserves bundle display fallback (%s)', (localized) => {
    const adapted = adaptBundle(bundle({ city: { id: 1, name: 'Краков', name_localized: localized, lat: 50, lng: 19 }, intro: null }))
    expect(adapted.city.name).toBe('Краков')
    expect(adapted.intro?.location).toBe('Краков')
  })

  it('preserves bundle content name as identity if canonical is absent', () => {
    expect(adaptBundle(bundle({ city: { id: 1, name: 'Краков', name_localized: 'Kraków', lat: 50, lng: 19 } })).city)
      .toMatchObject({ name: 'Kraków', nameCanonical: 'Краков' })
  })
})

const bundle = (extra: Partial<ApiQuestBundle> = {}): ApiQuestBundle => ({
  id: 1,
  quest_id: 'krakow-dragon',
  title: 'Smok',
  steps: [step('s1', { order: 1 }), step('s2', { order: 2 })] as unknown as ApiQuestBundle['steps'],
  finale: { text: '', video_url: null, poster_url: null },
  intro: step('intro') as unknown as ApiQuestBundle['intro'],
  storage_key: 'k',
  city: { id: 1, name: 'Kraków', name_canonical: 'Краков', lat: 50, lng: 19 },
  ...extra,
})

const meta = (extra: Partial<ApiQuestMeta> = {}): ApiQuestMeta => ({
  id: 1,
  quest_id: 'krakow-dragon',
  title: 'Smok',
  points: 5,
  city_id: '1',
  city_name: 'Kraków',
  lat: 50,
  lng: 19,
  duration_min: 60,
  difficulty: 'easy',
  tags: null,
  pet_friendly: false,
  cover_url: null,
  rating_avg: null,
  rating_count: 0,
  user_rating: null,
  completions_count: 0,
  is_completed_by_me: false,
  first_completer: null,
  ...extra,
})

describe('content locale in the quest model', () => {
  it('reads a response without locale fields as Russian', () => {
    const adapted = adaptBundle(bundle())
    expect(adapted.contentLocale).toBe('ru')
    expect(adapted.availableLocales).toEqual(['ru'])
    expect(adapted.intro?.contentLocale).toBe('ru')
    expect(adapted.steps.map((item) => item.contentLocale)).toEqual(['ru', 'ru'])

    expect(adaptMeta(meta())).toMatchObject({ contentLocale: 'ru', availableLocales: ['ru'] })
    expect(adaptMeta(meta()).cityNameCanonical).toBeUndefined()
    expect(adaptStep(step('s9') as never).contentLocale).toBe('ru')
  })

  it('stamps every step and the intro with the bundle content locale', () => {
    const adapted = adaptBundle(bundle({ content_locale: 'pl', source_locale: 'ru', available_locales: ['ru', 'pl'] }))
    expect(adapted.contentLocale).toBe('pl')
    expect(adapted.availableLocales).toEqual(['ru', 'pl'])
    expect(adapted.intro?.contentLocale).toBe('pl')
    expect(adapted.steps.map((item) => item.contentLocale)).toEqual(['pl', 'pl'])
    expect(adapted.city).toMatchObject({ name: 'Kraków', nameCanonical: 'Краков' })
  })

  it('stamps the synthesized intro too', () => {
    const adapted = adaptBundle(bundle({ intro: null, content_locale: 'en' }))
    expect(adapted.intro?.contentLocale).toBe('en')
  })

  it('keeps the canonical city name and published translations of a catalog entry', () => {
    expect(adaptMeta(meta({
      content_locale: 'pl',
      available_locales: ['ru', 'be', 'uk', 'pl', 'en'],
      city_name_canonical: 'Краков',
    }))).toMatchObject({
      cityName: 'Kraków',
      cityNameCanonical: 'Краков',
      contentLocale: 'pl',
      availableLocales: ['ru', 'be', 'uk', 'pl', 'en'],
    })
  })
})
