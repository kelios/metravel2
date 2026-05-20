/**
 * Re-export канонического модуля из @/utils/pluralize.
 * Сохранён для внутренних импортов services/pdf-export/**.
 * Новые импортёры за пределами pdf-export должны использовать '@/utils/pluralize'.
 */
export {
  formatDays,
  getDayLabel,
  getTravelLabel,
  getPhotoLabel,
  getCountryLabel,
  getLocationLabel,
} from '@/utils/pluralize'
