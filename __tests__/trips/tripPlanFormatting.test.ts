// __tests__/trips/tripPlanFormatting.test.ts
// Unit-тесты презентационных хелперов планирования поездок (Sprint 13 / FE-trip-tests #406).

import {
  PLAN_STATUS_LABEL,
  RSVP_LABEL,
  TRANSPORT_LABEL,
  formatDistance,
  formatDuration,
  formatTripDateTime,
  routeSummaryLine,
  routingStateHint,
} from '@/components/trips/planning/tripPlanFormatting'
import type { RouteSummary, RoutingState } from '@/api/plannedTrips'

// ── formatDistance ────────────────────────────────────────────────────────────

describe('formatDistance', () => {
  it('returns dash for zero', () => {
    expect(formatDistance(0)).toBe('—')
  })

  it('returns dash for negative', () => {
    expect(formatDistance(-1)).toBe('—')
  })

  it('formats sub-10 km with comma decimal', () => {
    expect(formatDistance(5.2)).toBe('5,2 км')
    expect(formatDistance(9.7)).toBe('9,7 км')
  })

  it('rounds km >= 10', () => {
    expect(formatDistance(252)).toBe('252 км')
    expect(formatDistance(178.5)).toBe('179 км')
  })

  it('uses comma for sub-10 boundary', () => {
    // 9.99 → still < 10 → decimal with comma
    expect(formatDistance(9.99)).toBe('10,0 км')
  })
})

// ── formatDuration ────────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('returns dash for zero', () => {
    expect(formatDuration(0)).toBe('—')
  })

  it('returns dash for negative', () => {
    expect(formatDuration(-5)).toBe('—')
  })

  it('formats minutes only when < 60', () => {
    expect(formatDuration(36)).toBe('36 мин')
    expect(formatDuration(1)).toBe('1 мин')
    expect(formatDuration(59)).toBe('59 мин')
  })

  it('formats hours + minutes', () => {
    expect(formatDuration(105)).toBe('1 ч 45 мин')
    expect(formatDuration(61)).toBe('1 ч 1 мин')
  })

  it('formats exact hours without minutes', () => {
    expect(formatDuration(120)).toBe('2 ч')
    expect(formatDuration(60)).toBe('1 ч')
  })
})

// ── routeSummaryLine ──────────────────────────────────────────────────────────

describe('routeSummaryLine', () => {
  it('returns fallback string for null', () => {
    expect(routeSummaryLine(null)).toBe('Маршрут не построен')
  })

  it('joins distance · duration · stops with separator', () => {
    const summary: RouteSummary = {
      distanceKm: 252,
      durationMin: 252,
      elevationGainM: 0,
      stopsCount: 3,
    }
    const line = routeSummaryLine(summary)
    expect(line).toContain('252 км')
    expect(line).toContain('·')
    expect(line).toContain('3 остановки')
  })

  it('uses singular form for 1 stop', () => {
    const summary: RouteSummary = {
      distanceKm: 10,
      durationMin: 30,
      elevationGainM: 0,
      stopsCount: 1,
    }
    expect(routeSummaryLine(summary)).toContain('1 остановка')
  })

  it('uses genitive plural for 2–4 stops', () => {
    const s2: RouteSummary = { distanceKm: 10, durationMin: 30, elevationGainM: 0, stopsCount: 2 }
    const s4: RouteSummary = { distanceKm: 10, durationMin: 30, elevationGainM: 0, stopsCount: 4 }
    expect(routeSummaryLine(s2)).toContain('2 остановки')
    expect(routeSummaryLine(s4)).toContain('4 остановки')
  })

  it('uses genitive plural for 5+ stops', () => {
    const s5: RouteSummary = { distanceKm: 10, durationMin: 30, elevationGainM: 0, stopsCount: 5 }
    const s11: RouteSummary = { distanceKm: 10, durationMin: 30, elevationGainM: 0, stopsCount: 11 }
    expect(routeSummaryLine(s5)).toContain('5 остановок')
    expect(routeSummaryLine(s11)).toContain('11 остановок')
  })

  it('formats zero distance correctly', () => {
    const summary: RouteSummary = {
      distanceKm: 0,
      durationMin: 0,
      elevationGainM: 0,
      stopsCount: 0,
    }
    const line = routeSummaryLine(summary)
    expect(line).toContain('—')
    expect(line).toContain('0 остановок')
  })
})

// ── routingStateHint ──────────────────────────────────────────────────────────

describe('routingStateHint', () => {
  const direct = (over: Partial<RoutingState> = {}): RoutingState => ({
    provider: 'direct',
    isOptimal: false,
    fallbackReason: null,
    warnings: [],
    ...over,
  })

  it('returns null when route is optimal', () => {
    expect(
      routingStateHint({ provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] }),
    ).toBeNull()
  })

  it('translates not_enough_points to actionable Russian text', () => {
    expect(routingStateHint(direct({ fallbackReason: 'not_enough_points' }))).toBe(
      'Добавьте минимум две точки маршрута — тогда мы построим дорогу.',
    )
  })

  it('translates provider-unavailable codes', () => {
    for (const code of [
      'route_provider_unavailable',
      'routing_provider_unavailable',
      'ors_not_configured',
      'ors_http_502',
      'ors_request_failed',
      'valhalla_not_configured',
    ]) {
      const hint = routingStateHint(direct({ fallbackReason: code }))
      expect(hint).toContain('Сервис построения маршрутов временно недоступен')
    }
  })

  it('never leaks raw machine codes to the user', () => {
    const hint = routingStateHint(direct({ fallbackReason: 'some_future_unknown_code' }))
    expect(hint).not.toContain('some_future_unknown_code')
    expect(hint).toMatch(/[а-яё]/i)
  })

  it('prefers a known warning code over fallbackReason', () => {
    const hint = routingStateHint(
      direct({ warnings: ['route_provider_unavailable'], fallbackReason: 'not_enough_points' }),
    )
    expect(hint).toContain('Сервис построения маршрутов временно недоступен')
  })

  it('passes through human Russian warnings as-is', () => {
    expect(routingStateHint(direct({ warnings: ['Маршрут показан приблизительно.'] }))).toBe(
      'Маршрут показан приблизительно.',
    )
  })

  it('falls back to generic Russian sentence for English sentences', () => {
    const hint = routingStateHint(
      direct({ warnings: ['Provider route is unavailable; direct-line fallback was used.'] }),
    )
    expect(hint).toBe(
      'Сервис роутинга не смог построить дорогу или тропу, линия показана приблизительно.',
    )
  })
})

// ── formatTripDateTime ────────────────────────────────────────────────────────

describe('formatTripDateTime', () => {
  it('formats date only when time is null', () => {
    expect(formatTripDateTime('2026-07-11', null)).toBe('11 июля 2026 г.')
  })

  it('appends time when provided', () => {
    expect(formatTripDateTime('2026-07-11', '08:00')).toBe('11 июля 2026 г., 08:00')
  })

  it('formats January correctly (month index 0)', () => {
    expect(formatTripDateTime('2026-01-05', null)).toBe('5 января 2026 г.')
  })

  it('returns original string for invalid date', () => {
    expect(formatTripDateTime('not-a-date', null)).toBe('not-a-date')
  })

  it('formats June date', () => {
    expect(formatTripDateTime('2026-06-28', '10:30')).toBe('28 июня 2026 г., 10:30')
  })
})

// ── Label maps ────────────────────────────────────────────────────────────────

describe('label maps', () => {
  it('TRANSPORT_LABEL has all 5 transport keys', () => {
    expect(Object.keys(TRANSPORT_LABEL).sort()).toEqual(
      ['bike', 'car', 'foot', 'mixed', 'public'],
    )
  })

  it('RSVP_LABEL has all 4 rsvp keys', () => {
    expect(Object.keys(RSVP_LABEL).sort()).toEqual(
      ['declined', 'going', 'invited', 'maybe'],
    )
  })

  it('PLAN_STATUS_LABEL has all 3 lifecycle keys', () => {
    expect(Object.keys(PLAN_STATUS_LABEL).sort()).toEqual(
      ['active', 'completed', 'planning'],
    )
  })

  it('TRANSPORT_LABEL values are non-empty strings', () => {
    for (const v of Object.values(TRANSPORT_LABEL)) {
      expect(typeof v).toBe('string')
      expect(v.length).toBeGreaterThan(0)
    }
  })
})
