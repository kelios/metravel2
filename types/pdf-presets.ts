// src/types/pdf-presets.ts
// Типы и пресеты для настроек PDF экспорта

import type { BookSettings } from '@/components/export/BookSettingsModal';

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
    name: 'Минималист',
    description: 'Только текст и ключевые фото. Идеально для быстрого обзора.',
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
    name: 'Фотоальбом',
    description: 'Акцент на фотографии с минимумом текста. Для визуального восприятия.',
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
    name: 'Путеводитель',
    description: 'Карты, адреса и рекомендации. Практичный формат для планирования.',
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
    name: 'Журнал путешественника',
    description: 'Полный формат со всеми деталями. Максимум информации.',
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
    name: 'Для печати',
    description: 'Оптимизировано для типографии. Высокое качество и правильные отступы.',
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
    name: 'Романтическое путешествие',
    description: 'Нежный дизайн для особенных воспоминаний.',
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
    name: 'Приключение',
    description: 'Динамичный стиль для активных путешествий.',
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
    name: 'Современный минимализм',
    description: 'Стильный и лаконичный дизайн для современных путешественников.',
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
 * Категории пресетов с описаниями
 */
export const PRESET_CATEGORIES: Record<PresetCategory, { name: string; description: string }> = {
  minimal: {
    name: 'Минимализм',
    description: 'Простые и лаконичные форматы',
  },
  detailed: {
    name: 'Детальные',
    description: 'Полная информация о путешествиях',
  },
  'photo-focused': {
    name: 'Фото',
    description: 'Акцент на визуальном контенте',
  },
  'map-focused': {
    name: 'Карты',
    description: 'С картами и навигацией',
  },
  print: {
    name: 'Печать',
    description: 'Оптимизировано для типографии',
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
