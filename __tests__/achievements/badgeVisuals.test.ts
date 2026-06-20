// __tests__/achievements/badgeVisuals.test.ts
// Unit tests for components/achievements/badgeVisuals.ts

import {
  badgeIcon,
  tierLabel,
  TIER_VISUALS,
} from '@/components/achievements/badgeVisuals'
import type { BadgeTier } from '@/api/achievements'

// badgeVisuals.ts only imports type-level things from @expo/vector-icons
// (FeatherName = keyof typeof Feather.glyphMap), so no runtime mock is needed.

// ── TIER_VISUALS completeness ──────────────────────────────────────────────────

describe('TIER_VISUALS', () => {
  const ALL_TIERS: BadgeTier[] = ['none', 'bronze', 'silver', 'gold', 'platinum', 'legendary']

  it('covers every BadgeTier', () => {
    for (const tier of ALL_TIERS) {
      expect(TIER_VISUALS[tier]).toBeDefined()
    }
  })

  it('every tier entry has ring, highlight, shade and label fields', () => {
    for (const tier of ALL_TIERS) {
      const v = TIER_VISUALS[tier]
      expect(typeof v.ring).toBe('string')
      expect(typeof v.highlight).toBe('string')
      expect(typeof v.shade).toBe('string')
      expect(typeof v.label).toBe('string')
    }
  })

  it('tier "none" has empty label', () => {
    expect(TIER_VISUALS.none.label).toBe('')
  })

  it('named tiers have non-empty Russian labels', () => {
    expect(TIER_VISUALS.bronze.label).toBe('Бронза')
    expect(TIER_VISUALS.silver.label).toBe('Серебро')
    expect(TIER_VISUALS.gold.label).toBe('Золото')
    expect(TIER_VISUALS.platinum.label).toBe('Платина')
    expect(TIER_VISUALS.legendary.label).toBe('Легенда')
  })

  it('ring colors are non-empty hex strings', () => {
    for (const tier of ALL_TIERS) {
      expect(TIER_VISUALS[tier].ring).toMatch(/^#[0-9A-Fa-f]{3,8}$/)
    }
  })
})

// ── tierLabel ──────────────────────────────────────────────────────────────────

describe('tierLabel', () => {
  it('returns empty string for "none"', () => {
    expect(tierLabel('none')).toBe('')
  })

  it('returns correct Russian label for each named tier', () => {
    expect(tierLabel('bronze')).toBe('Бронза')
    expect(tierLabel('silver')).toBe('Серебро')
    expect(tierLabel('gold')).toBe('Золото')
    expect(tierLabel('platinum')).toBe('Платина')
    expect(tierLabel('legendary')).toBe('Легенда')
  })
})

// ── badgeIcon ──────────────────────────────────────────────────────────────────

describe('badgeIcon', () => {
  // Slug keyword overrides

  it('returns "compass" for hiker slug (hik keyword)', () => {
    expect(badgeIcon('theme', 'hiker-bronze')).toBe('compass')
  })

  it('returns "compass" for trek keyword in slug', () => {
    expect(badgeIcon('theme', 'nordic-trek-gold')).toBe('compass')
  })

  it('returns "navigation" for cycl keyword (cyclist)', () => {
    expect(badgeIcon('theme', 'cyclist-bronze')).toBe('navigation')
  })

  it('returns "navigation" for bike keyword', () => {
    expect(badgeIcon('theme', 'mountain-bike')).toBe('navigation')
  })

  it('returns "navigation" for Cyrillic вело keyword', () => {
    expect(badgeIcon('theme', 'велопутешественник')).toBe('navigation')
  })

  it('returns "map" for auto keyword', () => {
    expect(badgeIcon('theme', 'auto-trip')).toBe('map')
  })

  it('returns "map" for car keyword', () => {
    expect(badgeIcon('theme', 'car-adventure')).toBe('map')
  })

  it('returns "anchor" for water keyword', () => {
    expect(badgeIcon('theme', 'water-sports')).toBe('anchor')
  })

  it('returns "anchor" for Cyrillic вод keyword', () => {
    // Note: slug must not contain "поход" (matched by hiker rule first)
    expect(badgeIcon('theme', 'водный-спорт')).toBe('anchor')
  })

  it('returns "map-pin" for city keyword', () => {
    expect(badgeIcon('theme', 'city-explorer')).toBe('map-pin')
  })

  it('returns "map-pin" for urban keyword', () => {
    expect(badgeIcon('theme', 'urban-quest')).toBe('map-pin')
  })

  it('returns "flag" for quest keyword in slug', () => {
    expect(badgeIcon('onboarding', 'quest-novice')).toBe('flag')
  })

  it('returns "heart" for like keyword', () => {
    expect(badgeIcon('social', 'like-collector')).toBe('heart')
  })

  it('returns "heart" for favorite keyword', () => {
    expect(badgeIcon('social', 'favorite-50')).toBe('heart')
  })

  it('returns "users" for subscrib keyword', () => {
    expect(badgeIcon('social', 'subscriber-silver')).toBe('users')
  })

  it('returns "globe" for countr keyword', () => {
    expect(badgeIcon('geo', 'country-hunter')).toBe('globe')
  })

  it('returns "globe" for world keyword', () => {
    expect(badgeIcon('geo', 'world-citizen')).toBe('globe')
  })

  it('returns "user-check" for profile keyword', () => {
    expect(badgeIcon('onboarding', 'profile-ready')).toBe('user-check')
  })

  // Category fallback (when no slug keyword matches)

  it('falls back to category icon for "onboarding" (star)', () => {
    expect(badgeIcon('onboarding', 'welcome')).toBe('star')
  })

  it('falls back to category icon for "writer" (edit-3)', () => {
    expect(badgeIcon('writer', 'first-steps')).toBe('edit-3')
  })

  it('falls back to category icon for "theme" (compass)', () => {
    expect(badgeIcon('theme', 'something-else')).toBe('compass')
  })

  it('falls back to category icon for "quests" (flag)', () => {
    expect(badgeIcon('quests', 'quest-master')).toBe('flag')
  })

  it('falls back to category icon for "social" (heart)', () => {
    expect(badgeIcon('social', 'crowd-favorite')).toBe('heart')
  })

  it('falls back to category icon for "geo" (globe)', () => {
    expect(badgeIcon('geo', 'world-explorer')).toBe('globe')
  })

  it('falls back to category icon for "monthly" (trending-up)', () => {
    expect(badgeIcon('monthly', 'jan-2026')).toBe('trending-up')
  })

  it('falls back to category icon for "other" (award)', () => {
    expect(badgeIcon('other', 'generic-badge')).toBe('award')
  })

  it('falls back to "award" for unknown category', () => {
    expect(badgeIcon('unknown_category', 'some-badge')).toBe('award')
  })

  it('slug keyword takes priority over category', () => {
    // "hik" slug keyword overrides "social" category (which would be "heart")
    expect(badgeIcon('social', 'hiker-social')).toBe('compass')
  })

  it('is case-insensitive for slug keywords', () => {
    expect(badgeIcon('theme', 'HIKER-Bronze')).toBe('compass')
    expect(badgeIcon('theme', 'Cycl-trip')).toBe('navigation')
  })
})
