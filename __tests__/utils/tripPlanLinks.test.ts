import {
  buildTripPlanCreateHref,
  buildTripPlanCreateHrefFromQuest,
  buildTripPlanPath,
  buildTripPlanPrefill,
  buildTripPlanUrl,
  buildTripTelegramShareUrl,
  getDefaultTripStartDate,
} from '@/utils/tripPlanLinks'

describe('tripPlanLinks', () => {
  it('uses the next Saturday as the default trip start date', () => {
    expect(getDefaultTripStartDate(new Date('2026-07-07T12:00:00'))).toBe('2026-07-11')
    expect(getDefaultTripStartDate(new Date('2026-07-11T12:00:00'))).toBe('2026-07-18')
  })

  it('builds a create link with the source travel context', () => {
    const href = buildTripPlanCreateHref({
      id: 42,
      slug: 'naroch-route',
      name: 'Нарочь',
      description: '<p>Озера и стоянки</p>',
    } as never)

    expect(href).toContain('/trips/plan/create?')
    expect(decodeURIComponent(href)).toContain('source=travel')
    expect(decodeURIComponent(href)).toContain('sourceTravelTitle=Нарочь')
    expect(decodeURIComponent(href)).toContain('https://metravel.by/travels/naroch-route')
  })

  it('creates form prefill from a source travel query', () => {
    const prefill = buildTripPlanPrefill({
      source: 'travel',
      sourceTravelTitle: 'Нарочь',
      sourceTravelUrl: 'https://metravel.by/travels/naroch-route',
      sourceTravelDescription: 'Озера и стоянки',
    })

    expect(prefill.title).toBe('Поездка по маршруту "Нарочь"')
    expect(prefill.description).toContain('Хочу организовать поездку')
    expect(prefill.description).toContain('https://metravel.by/travels/naroch-route')
  })

  // #3295: квест из ответа ассистента — та же подстановка, что у статьи.
  it('builds a create link and a prefill for a quest source', () => {
    const href = buildTripPlanCreateHrefFromQuest({
      title: 'Квест по Гродно: королевский город над Неманом',
      url: 'https://metravel.by/quests/11/grodno-royal',
      description: 'Городской квест по городу Гродно (Беларусь). Точек: 10',
    })
    expect(href.startsWith('/trips/plan/create?')).toBe(true)
    const params = Object.fromEntries(new URLSearchParams(href.split('?')[1]))
    expect(params).toEqual({
      source: 'quest',
      sourceTravelTitle: 'Квест по Гродно: королевский город над Неманом',
      sourceTravelUrl: 'https://metravel.by/quests/11/grodno-royal',
      sourceTravelDescription: 'Городской квест по городу Гродно (Беларусь). Точек: 10',
    })
    const prefill = buildTripPlanPrefill(params)
    expect(prefill.title).toContain('Квест по Гродно')
    expect(prefill.description).toContain('https://metravel.by/quests/11/grodno-royal')
    // Не адрес сайта в ссылку не идёт; неизвестный источник подстановки не даёт.
    expect(buildTripPlanCreateHrefFromQuest({ title: 'Квест', url: 'javascript:alert(1)' })).not.toContain('sourceTravelUrl')
    expect(buildTripPlanPrefill({ source: 'other', sourceTravelTitle: 'Квест' })).toEqual({})
    // Адрес из строки запроса в описание формы идёт только как http(s)-ссылка разумной длины (#3298).
    for (const sourceTravelUrl of ['javascript:alert(1)', 'data:text/html,x', `https://metravel.by/${'a'.repeat(600)}`]) {
      const description = buildTripPlanPrefill({ source: 'quest', sourceTravelTitle: 'Квест', sourceTravelUrl }).description ?? ''
      expect(description).toContain('Квест')
      expect(description).not.toContain('javascript:')
      expect(description).not.toContain('data:')
      expect(description).not.toContain('https://metravel.by/')
    }
  })

  it('builds a canonical planned-trip URL from numeric id only', () => {
    expect(buildTripPlanPath({ id: 8001, title: 'Браславы' })).toBe('/trips/plan/8001')
    expect(buildTripPlanUrl({ id: '8001', title: 'Браславы' })).toBe(
      'https://metravel.by/trips/plan/8001',
    )
    expect(buildTripPlanUrl({ id: 'draft-local', title: 'Черновик' })).toBe('')
  })

  it('builds Telegram share intent with encoded text and valid trip URL', () => {
    const shareUrl = buildTripTelegramShareUrl({
      id: 8001,
      title: 'Браславские озёра',
    })

    expect(shareUrl).toContain('https://t.me/share/url?')
    const parsed = new URL(shareUrl)
    expect(parsed.searchParams.get('url')).toBe('https://metravel.by/trips/plan/8001')
    expect(parsed.searchParams.get('text')).toContain('Браславские озёра')
  })
})
