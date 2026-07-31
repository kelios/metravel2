import {
  buildQuestPath,
  buildTravelPath,
  isUsableRouteSegment,
  normalizeRouteSegment,
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
  })
})
