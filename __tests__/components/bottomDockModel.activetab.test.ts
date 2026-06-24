/**
 * bottomDockModel.activetab.test.ts
 *
 * BUG-CLASS-1: Active tab-bar state regression tests
 *
 * Ловит классы ошибок, при которых:
 * - таб «Маршруты» (/search) подсвечен как активный на главной странице (/)
 * - квесты и карта разрешаются в одинаковый активный путь
 * - страницы деталей маршрута показывают ложный активный таб
 *
 * Дополняет: __tests__/components/bottomDockModel.test.ts
 */

import {
  normalizeBottomDockActivePath,
  BOTTOM_DOCK_ITEM_DEFS,
} from '@/components/layout/bottomDockModel'

describe('normalizeBottomDockActivePath — BUG-CLASS-1 active-tab regression', () => {
  // ── Home / root must never activate a primary tab ──────────────────────────

  it('returns empty string for "/" so no tab is highlighted on the landing page', () => {
    expect(normalizeBottomDockActivePath('/')).toBe('')
  })

  it('returns empty string for "/index" (Expo Router alias for root)', () => {
    expect(normalizeBottomDockActivePath('/index')).toBe('')
  })

  it('returns empty string for "/(tabs)" prefix (Expo Router group path)', () => {
    expect(normalizeBottomDockActivePath('/(tabs)')).toBe('')
  })

  it('returns empty string for "/(tabs)/index"', () => {
    expect(normalizeBottomDockActivePath('/(tabs)/index')).toBe('')
  })

  // ── Travel detail pages must not activate the "Маршруты" tab ────────────────

  it('returns empty string for /travels/<slug> (detail page must not show active tab)', () => {
    expect(normalizeBottomDockActivePath('/travels/my-great-trip')).toBe('')
  })

  it('returns empty string for /travels/123 (numeric id detail)', () => {
    expect(normalizeBottomDockActivePath('/travels/123')).toBe('')
  })

  it('returns empty string for /travel/<id> (editor / detail SPA route)', () => {
    expect(normalizeBottomDockActivePath('/travel/new')).toBe('')
    expect(normalizeBottomDockActivePath('/travel/42')).toBe('')
  })

  // ── Primary tabs resolve to their canonical route ───────────────────────────

  it('resolves /search and sub-paths to /search', () => {
    expect(normalizeBottomDockActivePath('/search')).toBe('/search')
    expect(normalizeBottomDockActivePath('/search?q=Brest')).toBe('/search')
  })

  it('resolves /map to /map', () => {
    expect(normalizeBottomDockActivePath('/map')).toBe('/map')
    expect(normalizeBottomDockActivePath('/map/route')).toBe('/map')
  })

  it('resolves /quests and sub-paths to /quests', () => {
    expect(normalizeBottomDockActivePath('/quests')).toBe('/quests')
    expect(normalizeBottomDockActivePath('/quests/krakow/dragon')).toBe('/quests')
  })

  it('resolves /profile to /profile', () => {
    expect(normalizeBottomDockActivePath('/profile')).toBe('/profile')
    expect(normalizeBottomDockActivePath('/profile/settings')).toBe('/profile')
  })

  // ── Quests and Map must resolve to DIFFERENT active paths ───────────────────
  // Regression guard: both tabs had the same icon class in Android QA round 2

  it('quests and map resolve to different active paths (visual distinction)', () => {
    const questPath = normalizeBottomDockActivePath('/quests')
    const mapPath = normalizeBottomDockActivePath('/map')
    expect(questPath).not.toBe(mapPath)
  })

  // ── Roulette should not activate "Маршруты" tab ────────────────────────────
  // (current implementation maps /roulette → /search; this is a known design choice;
  //  but it must NOT land on an empty string — the test just documents the mapping)

  it('roulette resolves to a non-empty path (some tab is active)', () => {
    const result = normalizeBottomDockActivePath('/roulette')
    // roulette is conceptually "search", so it should resolve to something
    expect(result).not.toBe('')
  })

  // ── Public trips ─────────────────────────────────────────────────────────────

  it('resolves /trips and sub-paths to /trips', () => {
    expect(normalizeBottomDockActivePath('/trips')).toBe('/trips')
    expect(normalizeBottomDockActivePath('/trips/42')).toBe('/trips')
  })

  // ── Other known routes should not accidentally activate the home tab ─────────

  it('does not resolve /places to /search', () => {
    expect(normalizeBottomDockActivePath('/places')).not.toBe('/search')
  })

  it('does not resolve /profile to /search', () => {
    expect(normalizeBottomDockActivePath('/profile')).not.toBe('/search')
  })
})

describe('BOTTOM_DOCK_ITEM_DEFS — BUG-CLASS-1 icon distinctness', () => {
  it('quests item has a different iconName than the map item', () => {
    const questsItem = BOTTOM_DOCK_ITEM_DEFS.find((item) => item.key === 'quests')
    const mapItem = BOTTOM_DOCK_ITEM_DEFS.find((item) => item.key === 'map')

    expect(questsItem).toBeDefined() // quests item must be in BOTTOM_DOCK_ITEM_DEFS
    expect(mapItem).toBeDefined()    // map item must be in BOTTOM_DOCK_ITEM_DEFS

    if (questsItem && mapItem) {
      // quests and map tabs must have visually distinct icon names
      expect(questsItem.iconName).not.toBe(mapItem.iconName)
    }
  })

  it('all primary dock items have unique iconNames', () => {
    const primaryItems = BOTTOM_DOCK_ITEM_DEFS.filter((item) => !item.isMore)
    const iconNames = primaryItems.map((item) => item.iconName)
    const uniqueIcons = new Set(iconNames)
    // All primary dock items must have unique icon names
    expect(uniqueIcons.size).toBe(primaryItems.length)
  })

  it('all primary dock items have unique keys', () => {
    const keys = BOTTOM_DOCK_ITEM_DEFS.map((item) => item.key)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(keys.length)
  })

  it('the home/маршруты item routes to /search, not to /', () => {
    const homeItem = BOTTOM_DOCK_ITEM_DEFS.find((item) => item.key === 'home')
    expect(homeItem).toBeDefined()
    if (homeItem) {
      expect(String(homeItem.route)).toBe('/search')
      expect(String(homeItem.route)).not.toBe('/')
    }
  })
})
