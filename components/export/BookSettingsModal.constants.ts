// components/export/BookSettingsModal.constants.ts
// Константы настроек фотоальбома (вынесено из BookSettingsModal.tsx, поведение не меняется)

import type { BookSettings, ChecklistSection } from './BookSettingsModal.types'
import { translate as i18nT } from '@/i18n'

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
  {
    value: 'clothing',
    get label() { return i18nT('export:components.export.checklist.clothing.label') },
    get items() { return [
      i18nT('export:components.export.checklist.clothing.layers'),
      i18nT('export:components.export.checklist.clothing.shoes'),
      i18nT('export:components.export.checklist.clothing.raincoat'),
    ] },
  },
  {
    value: 'food',
    get label() { return i18nT('export:components.export.checklist.food.label') },
    get items() { return [
      i18nT('export:components.export.checklist.food.snacks'),
      i18nT('export:components.export.checklist.food.thermos'),
      i18nT('export:components.export.checklist.food.dishes'),
    ] },
  },
  {
    value: 'electronics',
    get label() { return i18nT('export:components.export.checklist.electronics.label') },
    get items() { return [
      i18nT('export:components.export.checklist.electronics.powerBank'),
      i18nT('export:components.export.checklist.electronics.camera'),
      i18nT('export:components.export.checklist.electronics.adapters'),
    ] },
  },
  {
    value: 'documents',
    get label() { return i18nT('export:components.export.checklist.documents.label') },
    get items() { return [
      i18nT('export:components.export.checklist.documents.passport'),
      i18nT('export:components.export.checklist.documents.visas'),
      i18nT('export:components.export.checklist.documents.insurance'),
    ] },
  },
  {
    value: 'medicine',
    get label() { return i18nT('export:components.export.checklist.medicine.label') },
    get items() { return [
      i18nT('export:components.export.checklist.medicine.basicKit'),
      i18nT('export:components.export.checklist.medicine.bandages'),
      i18nT('export:components.export.checklist.medicine.sunProtection'),
    ] },
  },
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
