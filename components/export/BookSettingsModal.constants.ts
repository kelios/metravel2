// components/export/BookSettingsModal.constants.ts
// Константы настроек фотоальбома (вынесено из BookSettingsModal.tsx, поведение не меняется)

import type { BookSettings, ChecklistSection } from './BookSettingsModal.types'

export const DEFAULT_CHECKLIST_SELECTION: ChecklistSection[] = [
  'clothing',
  'food',
  'electronics',
]

// Цветовые темы и шрифты теперь фиксированы через defaultBookSettings,
// поэтому отдельные массивы опций для UI не нужны.

export const CHECKLIST_OPTIONS: Array<{
  value: ChecklistSection
  label: string
  items: string[]
}> = [
  { value: 'clothing', label: 'Одежда', items: ['Слои', 'Обувь', 'Дождевик'] },
  { value: 'food', label: 'Еда', items: ['Перекусы', 'Термос', 'Посуда'] },
  { value: 'electronics', label: 'Электроника', items: ['Повербанк', 'Камера', 'Переходники'] },
  { value: 'documents', label: 'Документы', items: ['Паспорт', 'Визы', 'Страховка'] },
  { value: 'medicine', label: 'Аптечка', items: ['Базовая аптечка', 'Пластыри', 'Солнцезащита'] },
]

export const defaultBookSettings: BookSettings = {
  title: '',
  subtitle: '',
  coverType: 'auto',
  template: 'minimal',
  sortOrder: 'manual',
  includeToc: true,
  includeGallery: true,
  includeMap: true,
  showCoordinatesOnMapPage: true,
  includeChecklists: false,
  checklistSections: DEFAULT_CHECKLIST_SELECTION,
  // Настройки галереи по умолчанию
  galleryLayout: 'grid',
  galleryColumns: 3,
  galleryPhotosPerPage: 2,
  galleryTwoPerPageLayout: 'vertical',
  showCaptions: true,
  captionPosition: 'bottom',
  gallerySpacing: 'normal',
}
