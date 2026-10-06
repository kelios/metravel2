// src/types/pdf-presets.ts
// Типы и пресеты для настроек PDF экспорта

import type { BookSettings } from '@/components/export/BookSettingsModal';
import { translate as i18nT } from '@/i18n';

export type PresetCategory = 'minimal' | 'detailed' | 'photo-focused' | 'map-focused' | 'print';

export interface BookPreset {
  id: string;
  name: string;
  description: string;
  category: PresetCategory;
  icon: string;
  settings: BookSettings;
  thumbnail?: string;
  isDefault?: boolean;
  isCustom?: boolean;
}

/**
 * Готовые пресеты настроек для быстрого старта
 */
export const BOOK_PRESETS: BookPreset[] = [
  {
    id: 'minimalist',
    get name() { return i18nT('common:pdfPresets.minimalist.name') },
    get description() { return i18nT('common:pdfPresets.minimalist.description') },
    category: 'minimal',
    icon: '📝',
    isDefault: true,
    settings: {
      title: 'Мои путешествия',
      subtitle: '',
      coverType: 'gradient',
      template: 'minimal',
      sortOrder: 'date-desc',
      includeToc: true,
      includeGallery: false,
      includeMap: false,
      includeChecklists: false,
      checklistSections: [],
    },
  },
  {
    id: 'photo-album',
    get name() { return i18nT('common:pdfPresets.photoAlbum.name') },
    get description() { return i18nT('common:pdfPresets.photoAlbum.description') },
    category: 'photo-focused',
    icon: '📸',
    settings: {
      title: 'Фотоальбом путешествий',
      subtitle: 'Визуальная история моих приключений',
      coverType: 'first-photo',
      template: 'light',
      sortOrder: 'date-desc',
      includeToc: false,
      includeGallery: true,
      includeMap: false,
      includeChecklists: false,
      checklistSections: [],
    },
  },
  {
    id: 'travel-guide',
    get name() { return i18nT('common:pdfPresets.travelGuide.name') },
    get description() { return i18nT('common:pdfPresets.travelGuide.description') },
    category: 'map-focused',
    icon: '🗺️',
    settings: {
      title: 'Путеводитель',
      subtitle: 'Проверенные места и маршруты',
      coverType: 'auto',
      template: 'travel-magazine',
      sortOrder: 'country',
      includeToc: true,
      includeGallery: true,
      includeMap: true,
      showCoordinatesOnMapPage: true,
      includeChecklists: true,
      checklistSections: ['documents', 'electronics', 'medicine'],
    },
  },
  {
    id: 'travel-journal',
    get name() { return i18nT('common:pdfPresets.travelJournal.name') },
    get description() { return i18nT('common:pdfPresets.travelJournal.description') },
    category: 'detailed',
    icon: '📖',
    settings: {
      title: 'Журнал путешествий',
      subtitle: 'Полная история моих приключений',
      coverType: 'auto',
      template: 'classic',
      sortOrder: 'date-desc',
      includeToc: true,
      includeGallery: true,
      includeMap: true,
      showCoordinatesOnMapPage: true,
      includeChecklists: true,
      checklistSections: ['clothing', 'food', 'electronics', 'documents', 'medicine'],
    },
  },
  {
    id: 'for-print',
    get name() { return i18nT('common:pdfPresets.forPrint.name') },
    get description() { return i18nT('common:pdfPresets.forPrint.description') },
    category: 'print',
    icon: '🖨️',
    settings: {
      title: 'Книга путешествий',
      subtitle: '',
      coverType: 'first-photo',
      template: 'classic',
      sortOrder: 'date-desc',
      includeToc: true,
      includeGallery: true,
      includeMap: true,
      showCoordinatesOnMapPage: false,
      includeChecklists: false,
      checklistSections: [],
    },
  },
  {
    id: 'romantic',
    get name() { return i18nT('common:pdfPresets.romantic.name') },
    get description() { return i18nT('common:pdfPresets.romantic.description') },
    category: 'photo-focused',
    icon: '💕',
    settings: {
      title: 'Наше путешествие',
      subtitle: 'Незабываемые моменты вместе',
      coverType: 'first-photo',
      template: 'romantic',
      sortOrder: 'date-desc',
      includeToc: false,
      includeGallery: true,
      includeMap: false,
      includeChecklists: false,
      checklistSections: [],
    },
  },
  {
    id: 'adventure',
    get name() { return i18nT('common:pdfPresets.adventure.name') },
    get description() { return i18nT('common:pdfPresets.adventure.description') },
    category: 'detailed',
    icon: '⛰️',
    settings: {
      title: 'Книга приключений',
      subtitle: 'Покоряя новые вершины',
      coverType: 'auto',
      template: 'adventure',
      sortOrder: 'date-desc',
      includeToc: true,
      includeGallery: true,
      includeMap: true,
      showCoordinatesOnMapPage: true,
      includeChecklists: true,
      checklistSections: ['clothing', 'electronics', 'medicine'],
    },
  },
  {
    id: 'modern-minimal',
    get name() { return i18nT('common:pdfPresets.modernMinimal.name') },
    get description() { return i18nT('common:pdfPresets.modernMinimal.description') },
    category: 'minimal',
    icon: '✨',
    settings: {
      title: 'Путешествия',
      subtitle: '',
      coverType: 'gradient',
      template: 'modern',
      sortOrder: 'date-desc',
      includeToc: true,
      includeGallery: true,
      includeMap: false,
      includeChecklists: false,
      checklistSections: [],
    },
  },
];

/**
 * Категории пресетов с описаниями. Подписи встроенных пресетов и категорий —
 * через `@/i18n` геттерами: один источник для окна сайта и нативного окна (#2229).
 */
export const PRESET_CATEGORIES: Record<PresetCategory, { name: string; description: string }> = {
  minimal: {
    get name() { return i18nT('common:pdfPresets.category.minimal.name') },
    get description() { return i18nT('common:pdfPresets.category.minimal.description') },
  },
  detailed: {
    get name() { return i18nT('common:pdfPresets.category.detailed.name') },
    get description() { return i18nT('common:pdfPresets.category.detailed.description') },
  },
  'photo-focused': {
    get name() { return i18nT('common:pdfPresets.category.photoFocused.name') },
    get description() { return i18nT('common:pdfPresets.category.photoFocused.description') },
  },
  'map-focused': {
    get name() { return i18nT('common:pdfPresets.category.mapFocused.name') },
    get description() { return i18nT('common:pdfPresets.category.mapFocused.description') },
  },
  print: {
    get name() { return i18nT('common:pdfPresets.category.print.name') },
    get description() { return i18nT('common:pdfPresets.category.print.description') },
  },
};

/**
 * Получить пресет по ID
 */
export function getPresetById(id: string): BookPreset | undefined {
  return BOOK_PRESETS.find((preset) => preset.id === id);
}

/**
 * Получить пресеты по категории
 */
export function getPresetsByCategory(category: PresetCategory): BookPreset[] {
  return BOOK_PRESETS.filter((preset) => preset.category === category);
}

/**
 * Получить пресет по умолчанию
 */
export function getDefaultPreset(): BookPreset {
  return BOOK_PRESETS.find((preset) => preset.isDefault) || BOOK_PRESETS[0];
}

/**
 * Сохранить пользовательский пресет
 */
export function createCustomPreset(
  name: string,
  description: string,
  settings: BookSettings,
  category: PresetCategory = 'detailed'
): BookPreset {
  return {
    id: `custom-${Date.now()}`,
    name,
    description,
    category,
    icon: '⭐',
    settings,
    isCustom: true,
  };
}
