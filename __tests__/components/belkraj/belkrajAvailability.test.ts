import {
  canRenderBelkrajWidget,
  parseBelkrajCoord,
  resolveBelkrajCountryCode,
} from '@/components/belkraj/belkrajAvailability'

const MINSK = { id: 1, address: 'Минск', lat: 53.9, lng: 27.56 }
const VITEBSK = { id: 1, address: 'Витебск', coord: '55.1904,30.2049' }
const VILNIUS = { id: 1, address: 'Вильнюс', lat: 54.6872, lng: 25.2797 }
// Квест `limassol-lionheart` (#1461): на этих координатах партнёр отдавал
// экскурсии по Минску, подписанные «Минск, Кипр».
const LIMASSOL = { id: 1, address: 'Лимасол', lat: 34.7071, lng: 33.0226 }

describe('belkrajAvailability', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    process.env.NODE_ENV = 'production'
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it('parses coords from both the numeric pair and the "lat,lng" string', () => {
    expect(parseBelkrajCoord(MINSK)).toEqual({ lat: 53.9, lng: 27.56 })
    expect(parseBelkrajCoord(VITEBSK)).toEqual({ lat: 55.1904, lng: 30.2049 })
    expect(parseBelkrajCoord({ id: 1, address: 'без координат' })).toBeNull()
    expect(parseBelkrajCoord({ id: 1, address: 'мусор', coord: 'нет,данных' })).toBeNull()
  })

  it('prefers the explicit country code and falls back to the first point coords', () => {
    expect(resolveBelkrajCountryCode([LIMASSOL], 'by')).toBe('BY')
    expect(resolveBelkrajCountryCode([MINSK])).toBe('BY')
    expect(resolveBelkrajCountryCode([LIMASSOL])).toBeUndefined()
    expect(resolveBelkrajCountryCode([VILNIUS])).toBeUndefined()
    // Мульти-страновые маршруты отдают countryCode списком — тогда решает первая точка.
    expect(resolveBelkrajCountryCode([MINSK], 'BY,PL')).toBe('BY')
    expect(resolveBelkrajCountryCode([])).toBeUndefined()
  })

  it('opens the widget for Belarusian points', () => {
    expect(canRenderBelkrajWidget([MINSK], 'BY')).toBe(true)
    expect(canRenderBelkrajWidget([VITEBSK])).toBe(true)
  })

  it('closes the widget outside Belarus: партнёр подменяет город, а не отдаёт пустоту', () => {
    expect(canRenderBelkrajWidget([LIMASSOL], 'CY')).toBe(false)
    // Без явного кода страны фолбэк на координаты обязан дать тот же ответ.
    expect(canRenderBelkrajWidget([LIMASSOL])).toBe(false)
    expect(canRenderBelkrajWidget([VILNIUS])).toBe(false)
    // Явный не-BY код перебивает белорусские координаты — гейт идёт за кодом.
    expect(canRenderBelkrajWidget([MINSK], 'PL')).toBe(false)
  })

  it('closes the widget without coords and outside production', () => {
    expect(canRenderBelkrajWidget([], 'BY')).toBe(false)
    expect(canRenderBelkrajWidget([{ id: 1, address: 'Минск' }], 'BY')).toBe(false)

    process.env.NODE_ENV = 'test'
    expect(canRenderBelkrajWidget([MINSK], 'BY')).toBe(false)
  })
})
