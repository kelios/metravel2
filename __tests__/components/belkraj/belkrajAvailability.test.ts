import {
  canRenderBelkrajWidget,
  isBelkrajSupportedCountry,
  parseBelkrajCoord,
  resolveBelkrajCountryCode,
} from '@/components/belkraj/belkrajAvailability'

const MINSK = { id: 1, address: 'Минск', lat: 53.9, lng: 27.56 }
const VITEBSK = { id: 1, address: 'Витебск', coord: '55.1904,30.2049' }
const VILNIUS = { id: 1, address: 'Вильнюс', lat: 54.6872, lng: 25.2797 }
const WARSAW = { id: 1, address: 'Варшава', lat: 52.2297, lng: 21.0122 }
// Каталог партнёра не покрывает Кипр: на этих координатах виджет отдаёт не
// пустоту, а тихую подмену на белорусский город (проверено на проде 2026-08-24).
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

  it('knows which countries the partner catalog covers', () => {
    expect(isBelkrajSupportedCountry('BY')).toBe(true)
    expect(isBelkrajSupportedCountry('PL')).toBe(true)
    // Регистр и пробелы не важны — код нормализуется.
    expect(isBelkrajSupportedCountry('pl')).toBe(true)
    expect(isBelkrajSupportedCountry(' by ')).toBe(true)
    // Страны без каталога (виджет подменяет их белорусским городом).
    expect(isBelkrajSupportedCountry('CY')).toBe(false)
    expect(isBelkrajSupportedCountry('US')).toBe(false)
    expect(isBelkrajSupportedCountry('')).toBe(false)
    expect(isBelkrajSupportedCountry(undefined)).toBe(false)
  })

  it('prefers the explicit country code and falls back to the first point coords', () => {
    // Явный код возвращается как есть — в URL уходит реальная страна точки,
    // даже когда каталога по ней нет (поддержку проверяет отдельный предикат).
    expect(resolveBelkrajCountryCode([LIMASSOL], 'by')).toBe('BY')
    expect(resolveBelkrajCountryCode([VILNIUS], 'lt')).toBe('LT')
    expect(resolveBelkrajCountryCode([LIMASSOL], 'cy')).toBe('CY')
    // Без явного кода координатный фолбэк распознаёт только Беларусь.
    expect(resolveBelkrajCountryCode([MINSK])).toBe('BY')
    expect(resolveBelkrajCountryCode([LIMASSOL])).toBeUndefined()
    expect(resolveBelkrajCountryCode([VILNIUS])).toBeUndefined()
    // Мульти-страновые маршруты отдают countryCode списком — тогда решает первая точка.
    expect(resolveBelkrajCountryCode([MINSK], 'BY,PL')).toBe('BY')
    expect(resolveBelkrajCountryCode([])).toBeUndefined()
  })

  it('opens the widget for every supported country, not just Belarus', () => {
    expect(canRenderBelkrajWidget([MINSK], 'BY')).toBe(true)
    // Координатный фолбэк по Беларуси без явного кода.
    expect(canRenderBelkrajWidget([VITEBSK])).toBe(true)
    // Ключевое изменение: поддержанная не-BY страна с координатами открывает виджет.
    expect(canRenderBelkrajWidget([VILNIUS], 'LT')).toBe(true)
    expect(canRenderBelkrajWidget([WARSAW], 'PL')).toBe(true)
  })

  it('closes the widget outside the partner catalog: он подменяет город, а не отдаёт пустоту', () => {
    // Страна без каталога — даже с валидными координатами.
    expect(canRenderBelkrajWidget([LIMASSOL], 'CY')).toBe(false)
    // Без явного кода фолбэк на не-BY координаты обязан дать тот же ответ.
    expect(canRenderBelkrajWidget([LIMASSOL])).toBe(false)
    expect(canRenderBelkrajWidget([VILNIUS])).toBe(false)
    // Явный неподдержанный код перебивает даже белорусские координаты — гейт идёт за кодом.
    expect(canRenderBelkrajWidget([MINSK], 'US')).toBe(false)
  })

  it('closes the widget without coords and outside production', () => {
    expect(canRenderBelkrajWidget([], 'BY')).toBe(false)
    expect(canRenderBelkrajWidget([{ id: 1, address: 'Минск' }], 'BY')).toBe(false)

    process.env.NODE_ENV = 'test'
    expect(canRenderBelkrajWidget([MINSK], 'BY')).toBe(false)
  })
})
