import type { ComponentProps } from 'react'
import type Feather from '@expo/vector-icons/Feather'

import {
  getTravelStatusCalendarDate,
  parseTravelStatusDateParts,
  type TravelModerationState,
  type TravelStatus,
  type TravelStatusEntry,
} from '@/stores/travelStatusStore'
import type { ThemedColors } from '@/hooks/useTheme'
import {
  getDateFieldForTravelStatus,
  getExplicitTravelStatusDate,
} from '@/utils/travelStatusCalendarDisplay'
import { translate as i18nT } from '@/i18n'


type IconName = ComponentProps<typeof Feather>['name']

export type CalendarTab = {
  key: TravelStatus
  label: string
  icon: IconName
}

export type EmptyStateConfig = {
  icon: string
  title: string
  description: string
  actionLabel: string
}

export type CalendarEntry = TravelStatusEntry

export type DateEditorState = {
  item: CalendarEntry
  status: TravelStatus
  value: string
  error: string
} | null

export type StatusBuckets = Record<TravelStatus, CalendarEntry[]>

export const TABS: CalendarTab[] = [
  { key: 'visited', get label() { return i18nT('calendarStatic:components.screens.calendar.calendarScreen_helpers.byl_9e3f47e6') }, icon: 'check-circle' },
  { key: 'planned', get label() { return i18nT('calendarStatic:components.screens.calendar.calendarScreen_helpers.planiruyu_841c53b4') }, icon: 'calendar' },
  { key: 'wishlist', get label() { return i18nT('calendarStatic:components.screens.calendar.calendarScreen_helpers.hochu_222ceb83') }, icon: 'bookmark' },
]

export const EMPTY_STATE: Record<TravelStatus, EmptyStateConfig> = {
  visited: {
    icon: 'check-circle',
    get title() { return i18nT('calendarStatic:components.screens.calendar.calendarScreen_helpers.net_poseschennyh_mest_fe3e827a') },
    get description() { return i18nT('calendarStatic:components.screens.calendar.calendarScreen_helpers.otkroy_puteshestvie_i_otmet_ego_statusom_byl_e4ebc1c3') },
    get actionLabel() { return i18nT('calendarStatic:empty.visited.action') },
  },
  planned: {
    icon: 'calendar',
    get title() { return i18nT('calendarStatic:components.screens.calendar.calendarScreen_helpers.net_zaplanirovannyh_poezdok_c49c3470') },
    get description() { return i18nT('calendarStatic:components.screens.calendar.calendarScreen_helpers.otkroy_lyuboe_puteshestvie_nazhmi_dobavit_v__6deb5823') },
    get actionLabel() { return i18nT('calendarStatic:empty.planned.action') },
  },
  wishlist: {
    icon: 'bookmark',
    get title() { return i18nT('calendarStatic:components.screens.calendar.calendarScreen_helpers.v_hochu_poehat_poka_pusto_3e455d21') },
    get description() { return i18nT('calendarStatic:components.screens.calendar.calendarScreen_helpers.otkroy_puteshestvie_i_vyberi_status_hochu_po_d97a09ce') },
    get actionLabel() { return i18nT('calendarStatic:empty.wishlist.action') },
  },
}

export const TAB_HINTS: Record<TravelStatus, string> = {
  get visited() { return i18nT('calendarStatic:tabHint.visited') },
  get planned() { return i18nT('calendarStatic:tabHint.planned') },
  get wishlist() { return i18nT('calendarStatic:tabHint.wishlist') },
}

export const CARD_META_ICON_STYLE = { marginRight: 4 } as const

export type ModerationBadgeConfig = {
  label: string
  icon: IconName
  background: string
  border: string
  text: string
}

// Бейдж черновика / на-модерации на карточке календаря. Опубликованные
// путешествия (moderationState === undefined) бейджа не получают.
export const getModerationBadge = (
  state: TravelModerationState | undefined,
  colors: ThemedColors
): ModerationBadgeConfig | null => {
  if (state === 'draft') {
    return {
      label: i18nT('calendar:components.screens.calendar.calendarScreen_helpers.chernovik_746d03fb'),
      icon: 'edit-3',
      background: colors.warningLight,
      border: colors.warning,
      text: colors.warningDark,
    }
  }
  if (state === 'pending') {
    return {
      label: i18nT('calendar:components.screens.calendar.calendarScreen_helpers.na_moderatsii_2acec5d7'),
      icon: 'clock',
      background: colors.infoLight,
      border: colors.info,
      text: colors.infoDark,
    }
  }
  return null
}

export const DEFAULT_BUCKETS: StatusBuckets = {
  visited: [],
  planned: [],
  wishlist: [],
}

export const getCalendarDate = (entry: CalendarEntry): string | undefined =>
  getExplicitTravelStatusDate(entry) ?? getTravelStatusCalendarDate(entry)

// Стабильный порядок раскладки бездатовых поездок: сначала по числовому id,
// потом по строковому — чтобы дни на сетке не прыгали между рендерами.
const compareEntriesForPlacement = (a: CalendarEntry, b: CalendarEntry): number => {
  const aNum = Number(a.id)
  const bNum = Number(b.id)
  if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) return aNum - bNum
  return String(a.id).localeCompare(String(b.id))
}

// Раскладывает записи на календарь с анти-коллизией: сперва фиксируются
// поездки с явной датой (якоря), затем бездатовые получают fallback-дату
// последовательно, обходя уже занятые дни (выходные — первыми, см.
// buildTravelMonthFallbackDate). Дата пишется в поле статуса ТОЛЬКО для
// маркеров на сетке — это derived-массив, наружу/в стор не персистится.
export const buildCalendarEntriesWithDates = (entries: CalendarEntry[]): CalendarEntry[] => {
  const ordered = [...entries].sort(compareEntriesForPlacement)
  const occupied = new Set<string>()
  const resolved = new Map<CalendarEntry, string | undefined>()

  for (const entry of ordered) {
    const explicit = getExplicitTravelStatusDate(entry)
    if (explicit) {
      occupied.add(explicit)
      resolved.set(entry, explicit)
    }
  }

  for (const entry of ordered) {
    if (resolved.has(entry)) continue
    const date = getTravelStatusCalendarDate(entry, occupied)
    if (date) occupied.add(date)
    resolved.set(entry, date)
  }

  return entries.map((entry) => {
    const date = resolved.get(entry)
    if (!date) return entry
    const dateField = getDateFieldForTravelStatus(entry.status)
    return entry[dateField] ? entry : { ...entry, [dateField]: date }
  })
}

export const getLocationLabel = (entry: CalendarEntry) =>
  [entry.city, entry.country].filter(Boolean).join(', ')

export const getTravelPeriodLabel = (entry: CalendarEntry) => {
  const parts = [entry.travelMonthName, entry.travelYear].filter(Boolean)
  if (parts.length > 0) return parts.join(' ')
  return entry.travelYear
}

export const getEntryKey = (entry: CalendarEntry) =>
  `${entry.status}-${String(entry.id)}`

export const isSelectedCalendarDate = (entry: CalendarEntry, selectedDate: string | null) => {
  if (!selectedDate) return true

  const explicitDate = getExplicitTravelStatusDate(entry)
  if (explicitDate) return explicitDate === selectedDate

  const selectedParts = parseTravelStatusDateParts(selectedDate)
  const displayParts = parseTravelStatusDateParts(getCalendarDate(entry))
  if (!selectedParts || !displayParts) return false

  return selectedParts.year === displayParts.year && selectedParts.month === displayParts.month
}

export const groupEntriesByStatus = (entries: TravelStatusEntry[]): StatusBuckets =>
  entries.reduce<StatusBuckets>(
    (buckets, entry) => {
      buckets[entry.status].push(entry)
      return buckets
    },
    { visited: [], planned: [], wishlist: [] }
  )

export const sortCalendarEntries = (entries: CalendarEntry[], status: TravelStatus) =>
  [...entries].sort((a, b) => {
    const dateA = getCalendarDate(a)
    const dateB = getCalendarDate(b)

    if (dateA && dateB) {
      return status === 'planned' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA)
    }

    if (!dateA && !dateB) return b.addedAt - a.addedAt
    return dateA ? -1 : 1
  })

export const getDateEditorSubtitle = (status?: TravelStatus) => {
  if (status === 'visited') return i18nT('calendar:components.screens.calendar.calendarScreen_helpers.ukazhi_datu_kogda_ty_byl_v_etom_puteshestvii_590bdf0e')
  if (status === 'wishlist') return i18nT('calendar:components.screens.calendar.calendarScreen_helpers.etot_status_prosto_sohranyaet_marshrut_v_vas_1bb862e4')
  return i18nT('calendar:components.screens.calendar.calendarScreen_helpers.ukazhi_datu_zaplanirovannoy_poezdki_09b2e98c')
}
