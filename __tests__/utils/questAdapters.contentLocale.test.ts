// #2197: язык контента в модели квеста. Ответ без полей — `ru`; шаги и интро
// получают локаль бандла (поле шагам бэкенд не отдаёт), по ней #2196 выбирает
// правило проверки ответа.
import type { ApiQuestBundle, ApiQuestMeta } from '@/api/quests'
import { adaptBundle, adaptMeta, adaptStep } from '@/utils/questAdapters'

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
