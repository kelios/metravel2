// Админская статистика приложения (#2843). Контракт ответа — #2842:
// GET /api/app-telemetry/stats/?from&to&platform&app_version, только is_superuser.

import { apiClient } from '@/api/client'

export const APP_STATS_PERIODS = [7, 30, 90] as const

export type AppStatsPeriod = (typeof APP_STATS_PERIODS)[number]

export type AppTelemetryStatsPlatform = '' | 'android' | 'ios'

export type AppTelemetryStatsQuery = {
  from: string
  to: string
  platform: AppTelemetryStatsPlatform
  appVersion: string
}

export type AppTelemetryStatsDay = {
  date: string
  new_installs: number
  active_installs: number
  sessions: number
}

export type AppTelemetryRetentionCell = {
  cohort_size: number
  retained: number
  rate: number
}

export type AppTelemetryCrashFreeRow = {
  app_version: string
  platform: string
  sessions: number
  crashed_sessions: number
  crash_free_percent: number
}

export type AppTelemetryTopCrash = {
  signature: string
  count: number
  installs_affected: number
  first_seen: string
  last_seen: string
  app_versions: string[]
  message: string
  stack: string
}

export type AppTelemetryFunnelStep = {
  name: string
  count: number
}

export type AppTelemetryStats = {
  days: AppTelemetryStatsDay[]
  retention: {
    d1: AppTelemetryRetentionCell
    d7: AppTelemetryRetentionCell
    d30: AppTelemetryRetentionCell
  }
  crash_free: AppTelemetryCrashFreeRow[]
  top_crashes: AppTelemetryTopCrash[]
  funnel: AppTelemetryFunnelStep[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const countOf = (value: unknown): number | null => {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return numeric
}

const percentOf = (value: unknown): number | null => {
  const numeric = countOf(value)
  if (numeric == null || numeric > 100) return null
  return numeric
}

const textOf = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const dayOf = (value: unknown): AppTelemetryStatsDay | null => {
  if (!isRecord(value)) return null
  const date = textOf(value.date)
  const newInstalls = countOf(value.new_installs)
  const activeInstalls = countOf(value.active_installs)
  const sessions = countOf(value.sessions)
  if (!date || newInstalls == null || activeInstalls == null || sessions == null) return null
  return { date, new_installs: newInstalls, active_installs: activeInstalls, sessions }
}

const retentionOf = (value: unknown): AppTelemetryRetentionCell | null => {
  if (!isRecord(value)) return null
  const cohort = countOf(value.cohort_size)
  const retained = countOf(value.retained)
  const rate = percentOf(value.rate)
  if (cohort == null || retained == null || rate == null) return null
  return { cohort_size: cohort, retained, rate }
}

const crashFreeOf = (value: unknown): AppTelemetryCrashFreeRow | null => {
  if (!isRecord(value)) return null
  const appVersion = textOf(value.app_version)
  const platform = textOf(value.platform)
  const sessions = countOf(value.sessions)
  const crashed = countOf(value.crashed_sessions)
  const percent = percentOf(value.crash_free_percent)
  if (!appVersion || !platform || sessions == null || crashed == null || percent == null) return null
  return {
    app_version: appVersion,
    platform,
    sessions,
    crashed_sessions: crashed,
    crash_free_percent: percent,
  }
}

const crashOf = (value: unknown): AppTelemetryTopCrash | null => {
  if (!isRecord(value)) return null
  const signature = textOf(value.signature)
  const count = countOf(value.count)
  const installs = countOf(value.installs_affected)
  const firstSeen = textOf(value.first_seen)
  const lastSeen = textOf(value.last_seen)
  const message = textOf(value.message)
  const stack = textOf(value.stack)
  const versions = Array.isArray(value.app_versions) ? value.app_versions.filter((item): item is string => typeof item === 'string') : null
  if (!signature || count == null || installs == null || !firstSeen || !lastSeen || message == null || stack == null || !versions) return null
  return {
    signature,
    count,
    installs_affected: installs,
    first_seen: firstSeen,
    last_seen: lastSeen,
    app_versions: versions,
    message,
    stack,
  }
}

const listOf = <T>(value: unknown, map: (item: unknown) => T | null): T[] | null => {
  if (!Array.isArray(value)) return null
  const items: T[] = []
  for (const item of value) {
    const mapped = map(item)
    if (!mapped) return null
    items.push(mapped)
  }
  return items
}

export function parseAppTelemetryStats(payload: unknown): AppTelemetryStats {
  if (!isRecord(payload) || !isRecord(payload.retention)) {
    throw new Error('Invalid app telemetry stats')
  }
  const days = listOf(payload.days, dayOf)
  const crashFree = listOf(payload.crash_free, crashFreeOf)
  const topCrashes = listOf(payload.top_crashes, crashOf)
  const funnel = listOf(payload.funnel, (item) => {
    if (!isRecord(item)) return null
    const name = textOf(item.name)
    const count = countOf(item.count)
    if (!name || count == null) return null
    return { name, count }
  })
  const d1 = retentionOf(payload.retention.d1)
  const d7 = retentionOf(payload.retention.d7)
  const d30 = retentionOf(payload.retention.d30)
  if (!days || !crashFree || !topCrashes || !funnel || !d1 || !d7 || !d30) {
    throw new Error('Invalid app telemetry stats')
  }
  return { days, retention: { d1, d7, d30 }, crash_free: crashFree, top_crashes: topCrashes, funnel }
}

export function isAppTelemetryStatsEmpty(stats: AppTelemetryStats): boolean {
  return (
    stats.days.length === 0 &&
    stats.crash_free.length === 0 &&
    stats.top_crashes.length === 0 &&
    stats.funnel.every((step) => step.count === 0)
  )
}

export function buildAppTelemetryStatsPath(query: AppTelemetryStatsQuery): string {
  const params = new URLSearchParams()
  params.set('from', query.from)
  params.set('to', query.to)
  if (query.platform) params.set('platform', query.platform)
  if (query.appVersion) params.set('app_version', query.appVersion)
  return `/app-telemetry/stats/?${params.toString()}`
}

export async function fetchAppTelemetryStats(query: AppTelemetryStatsQuery): Promise<AppTelemetryStats> {
  const payload = await apiClient.get<unknown>(buildAppTelemetryStatsPath(query))
  return parseAppTelemetryStats(payload)
}

const utcDay = (date: Date): string => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Включительное окно в UTC: «7 дней» — сегодня и шесть дней до него. */
export function appStatsRange(period: AppStatsPeriod, now = new Date()): { from: string; to: string } {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - (period - 1))
  return { from: utcDay(from), to: utcDay(to) }
}
