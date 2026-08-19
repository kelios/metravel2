// __tests__/trips/tripPlanFormatting.test.ts
// Unit-тесты презентационных хелперов планирования поездок (Sprint 13 / FE-trip-tests #406).

import {
  PLAN_STATUS_LABEL,
  RSVP_LABEL,
  TRANSPORT_LABEL,
  VISIBILITY_ICON_NAME,
  VISIBILITY_LABEL,
  formatDistance,
  formatDuration,
  formatTripDateTime,
  isRouteApproximate,
  routeSummaryLine,
  routingStateHint,
  routingStateLabel,
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

  // #1440: тело сведено к общему форматтеру расстояния, поэтому короткий
  // перегон печатается в метрах, а у больших чисел появляются разряды.
  it('switches to meters below a kilometre', () => {
    expect(formatDistance(0.8)).toBe('800 м')
  })

  it('groups thousands by locale', () => {
    expect(formatDistance(2800)).toBe('2\u00a0800 км')
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

// ── статусы живого превью маршрута (#1490) ───────────────────────────────────

describe('routingStateLabel / routingStateHint for the live preview', () => {
  const state = (over: Partial<RoutingState>): RoutingState => ({
    provider: 'preview',
    isOptimal: true,
    fallbackReason: null,
    warnings: [],
    ...over,
  })

  it('calls a preview route a road route, not a local estimate', () => {
    const preview = state({})

    expect(routingStateLabel(preview)).toBe('Маршрут построен по дорогам')
    expect(isRouteApproximate(preview)).toBe(false)
    expect(routingStateHint(preview)).toBeNull()
  })

  it('names the public/mixed line schematic and explains why', () => {
    const schematic = state({ provider: 'schematic', isOptimal: false })

    expect(routingStateLabel(schematic)).toBe('Схематичная линия')
    // Пунктир и предупреждение на карте держатся на этом флаге.
    expect(isRouteApproximate(schematic)).toBe(true)
    expect(routingStateHint(schematic)).toBe(
      'Для общественного и смешанного транспорта маршрут по дорогам не строится — точки соединены прямыми линиями.',
    )
  })

  it('keeps a degraded preview marked as approximate with the provider reason', () => {
    const degraded = state({
      provider: 'direct',
      isOptimal: false,
      fallbackReason: 'routing_provider_unavailable',
    })

    expect(isRouteApproximate(degraded)).toBe(true)
    expect(routingStateLabel(degraded)).toBe('Приблизительный маршрут')
    expect(routingStateHint(degraded)).toContain('Сервис построения маршрутов временно недоступен')
  })
})

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

  // #1313: возврат входа как есть — это и был баг: сырой ISO печатался на экране.
  it('renders the unavailable placeholder instead of the raw value', () => {
    expect(formatTripDateTime('not-a-date', null)).toBe('Дата не указана')
  })

  it('keeps the time carried by an ISO date-time value', () => {
    // Час зависит от зоны прогона, поэтому проверяем форму: локальная дата и
    // время присутствуют, а ISO-разделителя в выводе нет.
    const rendered = formatTripDateTime('2026-10-12T09:00:00+00:00', null)
    expect(rendered).toMatch(/^\d{1,2} \S+ 2026 г\., \d{2}:\d{2}$/)
    expect(rendered).not.toMatch(/T\d{2}:\d{2}|[+-]\d{2}:\d{2}/)
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

// #1314: иконка была захардкожена как «глаз» и противоречила подписи «Личная».
describe('VISIBILITY_ICON_NAME', () => {
  it('covers every visibility level declared by the label map', () => {
    expect(Object.keys(VISIBILITY_ICON_NAME).sort()).toEqual(Object.keys(VISIBILITY_LABEL).sort())
  })

  it.each([
    ['public', 'globe'],
    ['followers', 'users'],
    ['private', 'lock'],
  ] as const)('maps %s to the %s glyph', (visibility, icon) => {
    expect(VISIBILITY_ICON_NAME[visibility]).toBe(icon)
  })

  it('never reuses the all-seeing eye for a restricted trip', () => {
    expect(VISIBILITY_ICON_NAME.private).not.toBe('eye')
    expect(VISIBILITY_ICON_NAME.followers).not.toBe('eye')
  })
})
