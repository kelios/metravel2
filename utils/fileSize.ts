import { translate as i18nT } from '@/i18n'
import { formatInteger, formatNumber } from '@/i18n/format'

const KILOBYTE = 1024
const MEGABYTE = KILOBYTE * 1024

/**
 * Канонический вывод размера файла (#1459): и дробную часть, и единицу даёт
 * локаль — русскому пользователю «1,5 КБ», а не «1.5 KB». Единственная точка
 * входа для панели файлов маршрута и офлайн-хранилища: раньше каждый экран
 * склеивал единицу сам и округлял по-своему.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes >= MEGABYTE) {
    return i18nT('shared:utils.fileSize.megabytes', {
      value1: formatNumber(bytes / MEGABYTE, { maximumFractionDigits: 1 }),
    })
  }
  if (bytes >= KILOBYTE) {
    return i18nT('shared:utils.fileSize.kilobytes', {
      value1: formatNumber(bytes / KILOBYTE, { maximumFractionDigits: 1 }),
    })
  }
  return i18nT('shared:utils.fileSize.bytes', { value1: formatInteger(bytes) })
}
