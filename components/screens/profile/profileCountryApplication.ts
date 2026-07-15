import { createCollator, formatDate, selectPlural, translate as i18nT } from '@/i18n'

import type {
  ProfileCountryRow,
  VisitedCountryVisit,
} from './profileCountries'

export type VisitedCountryMeta = {
  visitedTravelsCount: number
  firstVisitedDate: string | null
  name: string
  visits: VisitedCountryVisit[]
}

export type VisitedCountryIndex = {
  visitedCodes: Set<string>
  byCode: Map<string, VisitedCountryMeta>
}

export type ProfileCountryApplicationRow = {
  id: string
  name: string
  code?: string
  visitCount: number
  firstKnownDateLabel: string | null
  summaryText: string
}

const formatMonthYear = (year: string, month: number) => {
  const numericYear = Number(year)
  if (!Number.isInteger(numericYear) || month < 1 || month > 12) return year
  return formatDate(new Date(Date.UTC(numericYear, month - 1, 1)), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const formatApplicationDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const exactMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (exactMatch) {
    const year = exactMatch[1]
    const month = Number(exactMatch[2])
    const day = Number(exactMatch[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return formatDate(new Date(Date.UTC(Number(year), month - 1, day)), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    }
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(trimmed)
  if (monthMatch) {
    const month = Number(monthMatch[2])
    if (month >= 1 && month <= 12) return formatMonthYear(monthMatch[1], month)
  }

  if (/^\d{4}$/.test(trimmed)) return trimmed
  return trimmed
}

const formatVisitCount = (count: number) => selectPlural(count, {
  one: i18nT('profile:components.screens.profile.profileCountries.value1_raz_7fb1bf15', { value1: count }),
  few: i18nT('profile:components.screens.profile.profileCountries.value1_raza_f1710173', { value1: count }),
  many: i18nT('profile:components.screens.profile.profileCountries.value1_raz_7fb1bf15', { value1: count }),
  other: i18nT('profile:components.screens.profile.profileCountries.value1_raz_7fb1bf15', { value1: count }),
})

const mergeVisits = (a: VisitedCountryVisit[], b: VisitedCountryVisit[]): VisitedCountryVisit[] => {
  if (a.length === 0) return b
  if (b.length === 0) return a
  const seen = new Set<string>()
  const merged: VisitedCountryVisit[] = []
  for (const visit of [...a, ...b]) {
    if (seen.has(visit.travelId)) continue
    seen.add(visit.travelId)
    merged.push(visit)
  }
  return merged
}

const pickEarlierDate = (a: string | null, b: string | null): string | null => {
  if (!a) return b
  if (!b) return a
  return a <= b ? a : b
}

export const buildVisitedCountryIndex = (rows: ProfileCountryRow[]): VisitedCountryIndex => {
  const visitedCodes = new Set<string>()
  const byCode = new Map<string, VisitedCountryMeta>()

  rows.forEach((row) => {
    if (!row.visited) return
    const code = typeof row.code === 'string' ? row.code.trim().toUpperCase() : ''
    if (!code) return

    visitedCodes.add(code)
    const existing = byCode.get(code)
    byCode.set(code, {
      visitedTravelsCount: Math.max(existing?.visitedTravelsCount ?? 0, row.visitedTravelsCount ?? 0),
      firstVisitedDate: pickEarlierDate(existing?.firstVisitedDate ?? null, row.firstVisitedDate ?? null),
      name: existing?.name || row.name || code,
      visits: mergeVisits(existing?.visits ?? [], row.visits ?? []),
    })
  })

  return { visitedCodes, byCode }
}

export const buildCountryApplicationRows = (
  rows: ProfileCountryRow[],
): ProfileCountryApplicationRow[] => {
  const collator = createCollator()
  return rows
    .filter((row) => row.visited)
    .map((row) => {
      const visitCount = Math.max(row.visitedTravelsCount ?? 1, 1)
      const firstKnownDateLabel = formatApplicationDate(row.firstVisitedDate)
      const summaryParts = [
        `${row.name}${row.code ? ` (${row.code})` : ''}`,
        formatVisitCount(visitCount),
        firstKnownDateLabel
          ? i18nT('profile:components.screens.profile.profileCountries.pervaya_izvestnaya_data_value1_924a9e90', { value1: firstKnownDateLabel })
          : i18nT('profile:components.screens.profile.profileCountries.daty_ne_ukazany_de171a90'),
      ]

      return {
        id: row.id,
        name: row.name,
        code: row.code,
        visitCount,
        firstKnownDateLabel,
        summaryText: summaryParts.join('; '),
      }
    })
    .sort((a, b) => collator.compare(a.name, b.name))
}
