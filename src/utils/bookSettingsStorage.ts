// src/utils/bookSettingsStorage.ts
// Утилиты для сохранения и восстановления настроек фотоальбома

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BookSettings } from '@/components/export/BookSettingsModal';

export const BOOK_SETTINGS_STORAGE_KEYS = {
  singleTravel: 'metravel:book-settings:single',
  travelList: 'metravel:book-settings:list',
  travelListEnhanced: 'metravel:book-settings:list-enhanced',
} as const;

const TEMPLATE_VALUES: BookSettings['template'][] = [
  'minimal',
  'light',
  'dark',
  'travel-magazine',
  'classic',
  'modern',
  'romantic',
  'adventure',
];

const COVER_TYPES: BookSettings['coverType'][] = ['auto', 'first-photo', 'gradient', 'custom'];
const SORT_ORDERS: BookSettings['sortOrder'][] = ['date-desc', 'date-asc', 'country', 'alphabetical'];
const CHECKLIST_OPTIONS: BookSettings['checklistSections'][number][] = [
  'clothing',
  'food',
  'electronics',
  'documents',
  'medicine',
];

function ensureValue<T>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function sanitizeChecklistSections(
  sections: unknown,
  fallback: BookSettings['checklistSections']
): BookSettings['checklistSections'] {
  if (!Array.isArray(sections)) return fallback;
  const filtered = sections.filter((section): section is BookSettings['checklistSections'][number] =>
    CHECKLIST_OPTIONS.includes(section as BookSettings['checklistSections'][number])
  );
  return filtered.length ? filtered : fallback;
}

function normalizeBookSettings(
  base: BookSettings,
  stored: Partial<BookSettings> | null
): BookSettings {
  if (!stored) {
    return base;
  }

  return {
    ...base,
    ...stored,
    title: base.title,
    subtitle: base.subtitle,
    template: ensureValue(TEMPLATE_VALUES, stored.template, base.template),
    coverType: ensureValue(COVER_TYPES, stored.coverType, base.coverType),
    sortOrder: ensureValue(SORT_ORDERS, stored.sortOrder, base.sortOrder),
    includeToc: typeof stored.includeToc === 'boolean' ? stored.includeToc : base.includeToc,
    includeGallery: typeof stored.includeGallery === 'boolean' ? stored.includeGallery : base.includeGallery,
    includeMap: typeof stored.includeMap === 'boolean' ? stored.includeMap : base.includeMap,
    includeChecklists:
      typeof stored.includeChecklists === 'boolean' ? stored.includeChecklists : base.includeChecklists,
    checklistSections: sanitizeChecklistSections(stored.checklistSections, base.checklistSections),
  };
}

export async function loadBookSettingsOrDefault(
  key: string,
  baseSettings: BookSettings
): Promise<BookSettings> {
  if (typeof AsyncStorage?.getItem !== 'function') {
    return baseSettings;
  }

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return baseSettings;
    }
    const parsed = JSON.parse(raw) as Partial<BookSettings>;
    return normalizeBookSettings(baseSettings, parsed);
  } catch (error) {
    console.warn('[bookSettingsStorage] Failed to load settings', error);
    return baseSettings;
  }
}

export async function saveBookSettings(key: string, settings: BookSettings): Promise<void> {
  if (typeof AsyncStorage?.setItem !== 'function') {
    return;
  }

  try {
    await AsyncStorage.setItem(key, JSON.stringify(settings));
  } catch (error) {
    console.warn('[bookSettingsStorage] Failed to save settings', error);
  }
}
