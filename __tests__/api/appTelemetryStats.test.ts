import { apiClient } from '@/api/client'
import {
  appStatsRange,
  buildAppTelemetryStatsPath,
  fetchAppTelemetryStats,
  isAppTelemetryStatsEmpty,
  parseAppTelemetryStats,
} from '@/api/appTelemetryStats'

jest.mock('@/api/client', () => ({
  apiClient: { get: jest.fn() },
}))

const payload = {
  days: [{ date: '2026-10-27', new_installs: 2, active_installs: 5, sessions: 8 }],
  retention: {
    d1: { cohort_size: 10, retained: 4, rate: 40 },
    d7: { cohort_size: 8, retained: 2, rate: 25 },
    d30: { cohort_size: 0, retained: 0, rate: 0 },
  },
  crash_free: [{
    app_version: '1.2.3',
    platform: 'ios',
    sessions: 8,
    crashed_sessions: 1,
    crash_free_percent: '87.50',
  }],
  top_crashes: [{
    signature: 'abc',
    count: 3,
    installs_affected: 2,
    first_seen: '2026-10-20T10:00:00Z',
    last_seen: '2026-10-27T12:00:00Z',
    app_versions: ['1.2.3'],
    message: 'Boom in map',
    stack: 'at renderMap (MapScreen.tsx:10:5)',
  }],
  funnel: [
    { name: 'app_first_open', count: 2 },
    { name: 'app_open', count: 0 },
  ],
}

describe('app telemetry stats (#2843)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('строит адрес с фильтрами и без пустых параметров', () => {
    expect(buildAppTelemetryStatsPath({
      from: '2026-10-01',
      to: '2026-10-28',
      platform: '',
      appVersion: '',
    })).toBe('/app-telemetry/stats/?from=2026-10-01&to=2026-10-28')
    expect(buildAppTelemetryStatsPath({
      from: '2026-10-01',
      to: '2026-10-28',
      platform: 'ios',
      appVersion: '1.2.3',
    })).toBe('/app-telemetry/stats/?from=2026-10-01&to=2026-10-28&platform=ios&app_version=1.2.3')
  })

  it('считает включительное UTC-окно 7, 30 и 90 дней', () => {
    const now = new Date('2026-10-28T15:00:00Z')
    expect(appStatsRange(7, now)).toEqual({ from: '2026-10-22', to: '2026-10-28' })
    expect(appStatsRange(30, now)).toEqual({ from: '2026-09-29', to: '2026-10-28' })
    expect(appStatsRange(90, now)).toEqual({ from: '2026-07-31', to: '2026-10-28' })
  })

  it('принимает процент строкой, как его отдаёт Django', () => {
    const stats = parseAppTelemetryStats(payload)
    expect(stats.crash_free[0].crash_free_percent).toBe(87.5)
    expect(stats.retention.d1).toEqual({ cohort_size: 10, retained: 4, rate: 40 })
    expect(isAppTelemetryStatsEmpty(stats)).toBe(false)
  })

  it('считает пустым ответ без дней, сессий, падений и событий', () => {
    const empty = parseAppTelemetryStats({
      ...payload,
      days: [],
      crash_free: [],
      top_crashes: [],
      funnel: [{ name: 'app_open', count: 0 }],
    })
    expect(isAppTelemetryStatsEmpty(empty)).toBe(true)
  })

  it('отклоняет ответ без удержания', () => {
    expect(() => parseAppTelemetryStats({ ...payload, retention: {} })).toThrow(/Invalid app telemetry stats/)
  })

  it('запрашивает статистику и разбирает тело', async () => {
    ;(apiClient.get as jest.Mock).mockResolvedValue(payload)
    const query = { from: '2026-10-22', to: '2026-10-28', platform: 'android' as const, appVersion: '' }
    await expect(fetchAppTelemetryStats(query)).resolves.toMatchObject({
      days: [{ new_installs: 2 }],
    })
    expect(apiClient.get).toHaveBeenCalledWith('/app-telemetry/stats/?from=2026-10-22&to=2026-10-28&platform=android')
  })
})
