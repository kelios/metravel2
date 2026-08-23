import {
  buildQuestPath,
  buildTravelPath,
  buildTravelPathFromTravel,
  isUsableRouteSegment,
  normalizeRouteSegment,
  sanitizeTravelHref,
} from '@/utils/routePaths'

// Регресс на #1185: прод отдавал 404 на /quests/undefined/undefined,
// /api/quests/by-quest-id/undefined/ и /travels/null — все три адреса построил
// сам фронт из пустых полей.
describe('utils/routePaths', () => {
  describe('normalizeRouteSegment', () => {
    it('keeps ordinary slugs and numeric ids', () => {
      expect(normalizeRouteSegment('minsk-cmok')).toBe('minsk-cmok')
      expect(normalizeRouteSegment(42)).toBe('42')
      expect(normalizeRouteSegment(' spaced ')).toBe('spaced')
    })

    it('rejects empty values', () => {
      expect(normalizeRouteSegment(null)).toBeNull()
      expect(normalizeRouteSegment(undefined)).toBeNull()
      expect(normalizeRouteSegment('')).toBeNull()
      expect(normalizeRouteSegment('   ')).toBeNull()
      expect(normalizeRouteSegment(Number.NaN)).toBeNull()
      expect(normalizeRouteSegment({})).toBeNull()
    })

    it('rejects string literals of emptiness — the router hands segments back as text', () => {
      expect(normalizeRouteSegment('undefined')).toBeNull()
      expect(normalizeRouteSegment('null')).toBeNull()
      expect(normalizeRouteSegment('NaN')).toBeNull()
      expect(normalizeRouteSegment('Undefined')).toBeNull()
    })

    it('isUsableRouteSegment mirrors the normalizer', () => {
      expect(isUsableRouteSegment('minsk')).toBe(true)
      expect(isUsableRouteSegment('undefined')).toBe(false)
      expect(isUsableRouteSegment(null)).toBe(false)
    })
  })

  describe('buildQuestPath', () => {
    it('builds the quest route from a city and a quest id', () => {
      expect(buildQuestPath('minsk', 'minsk-cmok')).toBe('/quests/minsk/minsk-cmok')
      expect(buildQuestPath('brest', 7)).toBe('/quests/brest/7')
    })

    it('returns null when either part is missing', () => {
      expect(buildQuestPath(undefined, 'minsk-cmok')).toBeNull()
      expect(buildQuestPath('minsk', undefined)).toBeNull()
      expect(buildQuestPath(undefined, undefined)).toBeNull()
      expect(buildQuestPath('', '')).toBeNull()
    })

    it('returns null for the literal segments seen in production 404s', () => {
      expect(buildQuestPath('undefined', 'undefined')).toBeNull()
      expect(buildQuestPath('minsk', 'null')).toBeNull()
    })

    it('escapes unsafe characters instead of emitting a broken path', () => {
      expect(buildQuestPath('minsk', 'a b')).toBe('/quests/minsk/a%20b')
    })
  })

  describe('buildTravelPath', () => {
    it('builds the travel route from a slug or a positive id', () => {
      expect(buildTravelPath('grodno')).toBe('/travels/grodno')
      expect(buildTravelPath(77)).toBe('/travels/77')
      expect(buildTravelPath('77')).toBe('/travels/77')
    })

    it('returns null for empty values and empty-literals', () => {
      expect(buildTravelPath(null)).toBeNull()
      expect(buildTravelPath(undefined)).toBeNull()
      expect(buildTravelPath('null')).toBeNull()
      expect(buildTravelPath('undefined')).toBeNull()
    })

    it('returns null for non-positive ids — /travels/0 is as broken as /travels/null', () => {
      expect(buildTravelPath(0)).toBeNull()
      expect(buildTravelPath(-3)).toBeNull()
    })

    it('keeps the segment raw when encoding is switched off', () => {
      // Ветка для travelSeo/hero/sticky-actions: там адрес исторически
      // собирается без encodeURIComponent.
      expect(buildTravelPath('a b', { encode: false })).toBe('/travels/a b')
      expect(buildTravelPath('a b')).toBe('/travels/a%20b')
    })
  })

  // #1438: готовый адрес из поля `url` карточки уходил в `href` без проверки —
  // одна запись с `/travels/null` делала кликабельной ссылку в 404.
  describe('sanitizeTravelHref', () => {
    it.each([
      '/travels/null',
      '/travels/undefined',
      '/travels/0',
      '/travels/null/photos',
      '/travels/null?returnTo=%2Fsearch',
      '/travels/%6Eull',
    ])('rejects our travel path with an unusable segment: %p', (href) => {
      expect(sanitizeTravelHref(href)).toBeNull()
    })

    it('passes healthy travel paths through untouched', () => {
      expect(sanitizeTravelHref('/travels/grodno')).toBe('/travels/grodno')
      expect(sanitizeTravelHref('/travels/77?returnTo=%2Fsearch')).toBe(
        '/travels/77?returnTo=%2Fsearch',
      )
    })

    it('does not touch non-travel and external links', () => {
      // Абсолютный адрес — внешняя ссылка, наш роутинг её не обслуживает:
      // подменять её собственным `/travels/<id>` нельзя.
      expect(sanitizeTravelHref('https://example.com/travels/null')).toBe(
        'https://example.com/travels/null',
      )
      expect(sanitizeTravelHref('/quests/5/yerevan-ararat')).toBe('/quests/5/yerevan-ararat')
      expect(sanitizeTravelHref('/travelsby')).toBe('/travelsby')
    })

    it('returns null for empty input', () => {
      expect(sanitizeTravelHref('')).toBeNull()
      expect(sanitizeTravelHref(null)).toBeNull()
      expect(sanitizeTravelHref(undefined)).toBeNull()
    })
  })
  // #1438: двухступенчатый фолбэк «слаг → числовой id» был скопирован в карточке,
  // в шапке детали и в SEO-слое; копии успели разъехаться контрактом, поэтому
  // реализация здесь одна.
  describe('buildTravelPathFromTravel', () => {
    it('prefers the slug', () => {
      expect(buildTravelPathFromTravel({ slug: 'grodno-forty', id: 228 })).toBe(
        '/travels/grodno-forty',
      )
    })

    it('falls back to the numeric id when the slug is unusable', () => {
      for (const slug of [null, undefined, '', 'null', 'undefined', 'NaN', 'none']) {
        expect(buildTravelPathFromTravel({ slug, id: 228 })).toBe('/travels/228')
      }
    })

    it('returns null when neither key is usable', () => {
      expect(buildTravelPathFromTravel({ slug: 'null', id: 0 })).toBeNull()
      expect(buildTravelPathFromTravel({ slug: null, id: null })).toBeNull()
      expect(buildTravelPathFromTravel(null)).toBeNull()
      expect(buildTravelPathFromTravel(undefined)).toBeNull()
    })

    it('honours the encode option like the segment builder', () => {
      expect(buildTravelPathFromTravel({ slug: 'кострома тур' })).toBe(
        '/travels/%D0%BA%D0%BE%D1%81%D1%82%D1%80%D0%BE%D0%BC%D0%B0%20%D1%82%D1%83%D1%80',
      )
      expect(buildTravelPathFromTravel({ slug: 'кострома тур' }, { encode: false })).toBe(
        '/travels/кострома тур',
      )
    })
  })
})
