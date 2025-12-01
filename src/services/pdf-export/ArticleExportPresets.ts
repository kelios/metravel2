// src/services/pdf-export/ArticleExportPresets.ts
// Архитектура: пресеты настроек экспорта статьи путешествия в PDF

import type { ArticleExportSettings } from './generators/ArticlePdfGenerator';

export type ArticleExportPresetId = 'default' | 'print' | 'dark' | 'magazine';

export interface ArticleExportPreset {
  id: ArticleExportPresetId;
  label: string;
  description: string;
  settings: ArticleExportSettings;
}

export const ARTICLE_EXPORT_PRESETS: Record<ArticleExportPresetId, ArticleExportPreset> = {
  default: {
    id: 'default',
    label: 'Стандартный путеводитель',
    description: 'Светлая тема, формат A4, с оглавлением, картой и рекомендациями (если данные есть).',
    settings: {
      theme: 'light',
      format: 'A4',
      includeToc: true,
      includeMap: true,
      includeRecommendations: true,
      language: 'ru',
    },
  },
  print: {
    id: 'print',
    label: 'Минималистичный для печати',
    description: 'Минималистичная тема, оптимизированная для печати с меньшим количеством фона.',
    settings: {
      theme: 'simple',
      format: 'A4',
      includeToc: true,
      includeMap: false,
      includeRecommendations: false,
      language: 'ru',
    },
  },
  dark: {
    id: 'dark',
    label: 'Тёмная тема для экрана',
    description: 'Тёмная тема для комфортного чтения с экрана.',
    settings: {
      theme: 'dark',
      format: 'A4',
      includeToc: true,
      includeMap: true,
      includeRecommendations: true,
      language: 'ru',
    },
  },
  magazine: {
    id: 'magazine',
    label: 'Журнальная вёрстка',
    description: 'Журнальная вёрстка с акцентом на визуальный контент.',
    settings: {
      theme: 'magazine',
      format: 'A4',
      includeToc: true,
      includeMap: true,
      includeRecommendations: true,
      language: 'ru',
    },
  },
};
