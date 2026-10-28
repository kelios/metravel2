import { translate as i18nT } from '@/i18n'
import { formatDate, formatDateTime, formatInteger, formatNumber } from '@/i18n/format'

export const appStatsPlatformLabel = (platform: string): string => {
  if (platform === 'android') return i18nT('appStatsStatic:filters.platformAndroid')
  if (platform === 'ios') return i18nT('appStatsStatic:filters.platformIos')
  return platform
}

export const appStatsPercent = (rate: number): string =>
  formatNumber(rate / 100, { style: 'percent', maximumFractionDigits: 1 })

export const appStatsCount = (value: number): string => formatInteger(value)

export const appStatsDayLabel = (isoDate: string): string =>
  formatDate(`${isoDate}T00:00:00Z`, { day: 'numeric', month: 'short', timeZone: 'UTC' })

export const appStatsDateTimeLabel = (iso: string): string => formatDateTime(iso)

export const meterRatio = (value: number, max: number): number => (max > 0 ? value / max : 0)
