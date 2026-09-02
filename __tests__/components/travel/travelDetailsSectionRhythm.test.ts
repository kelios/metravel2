/**
 * Секции детали путешествия рисуют два набора стилей: hero-набор
 * (`useTravelDetailsHeroStyles`) и общий (`useTravelDetailsStyles`). Пока
 * `sectionContainer`, `contentStable` и `quickFactsContainer` были объявлены в
 * каждом наборе отдельно, значения разошлись: на web hero давал секции 40px
 * снизу, общий набор — 32px, и отступ зависел от того, каким хуком отрисован
 * блок (#1704).
 *
 * Единственное определение живёт в `TRAVEL_DETAILS_SECTION_RHYTHM`, оба набора
 * его раскладывают спредом. Тест держит паритет на web, где расхождение и
 * жило: на native оба набора совпадали и до починки, поэтому дефолтного
 * прогона (`Platform.OS === 'ios'`) для регрессии недостаточно.
 */

type StyleSet = Record<string, Record<string, unknown>>

const loadStyleSetsFor = async (os: 'web' | 'ios') => {
  jest.resetModules()

  jest.doMock('react-native', () => {
    const actual = jest.requireActual('react-native')
    const platform = {
      OS: os,
      select: (spec: Record<string, unknown>) => (os in spec ? spec[os] : spec.default),
    }
    // Proxy, а не спред: спред react-native дёргает все ленивые геттеры модуля.
    return new Proxy(actual, {
      get: (target, prop) => (prop === 'Platform' ? platform : Reflect.get(target, prop)),
    })
  })

  const [{ getTravelDetailsHeroStyles }, { getTravelDetailsStyles }, { getThemedColors }] =
    await Promise.all([
      import('@/components/travel/details/TravelDetailsHeroStyles'),
      import('@/components/travel/details/TravelDetailsStyles'),
      import('@/constants/designSystem'),
    ])

  const colors = getThemedColors(false)

  return {
    hero: getTravelDetailsHeroStyles(colors) as unknown as StyleSet,
    shared: getTravelDetailsStyles(colors) as unknown as StyleSet,
  }
}

describe('вертикальный ритм секций travel details', () => {
  afterEach(() => {
    jest.dontMock('react-native')
    jest.resetModules()
  })

  it.each(['web', 'ios'] as const)(
    'на %s hero-набор и общий набор дают секции один и тот же ритм',
    async (os) => {
      const { hero, shared } = await loadStyleSetsFor(os)
      const { TRAVEL_DETAILS_SECTION_RHYTHM } = await import(
        '@/components/travel/details/styles/travelDetailsSectionRhythm'
      )

      for (const key of Object.keys(TRAVEL_DETAILS_SECTION_RHYTHM)) {
        expect(hero[key]).toEqual(shared[key])
      }
    },
  )

  it('оставляет секции 32px снизу и на web, и на native', async () => {
    // Последовательно: `loadStyleSetsFor` сбрасывает реестр модулей, параллельный
    // прогон двух платформ смешал бы наборы.
    const web = (await loadStyleSetsFor('web')).hero.sectionContainer.marginBottom
    const native = (await loadStyleSetsFor('ios')).hero.sectionContainer.marginBottom

    expect(web).toBe(32)
    expect(native).toBe(32)
  })

  it('не возвращает второй, ни разу не прочитанный комплект quickJump* в nav-наборе', async () => {
    const { createTravelDetailsNavStyles } = await import(
      '@/components/travel/details/styles/travelDetailsNavStyles'
    )
    const { getThemedColors } = await import('@/constants/designSystem')

    const navKeys = Object.keys(createTravelDetailsNavStyles(getThemedColors(false)))

    expect(navKeys.filter((key) => key.startsWith('quickJump'))).toEqual([])
  })
})
