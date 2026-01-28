// src/services/pdf-export/generators/v2/types/index.ts
// ✅ ТИПЫ: Общие типы для новой архитектуры PDF-генератора

import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/src/types/pdf-export';
import type { PdfThemeConfig } from '../../../themes/PdfThemeConfig';

/**
 * Контекст для генерации страницы
 */
export interface PageContext {
  travel?: TravelForBook;
  travels?: TravelForBook[];
  settings: BookSettings;
  theme: PdfThemeConfig;
  pageNumber: number;
  metadata?: Record<string, any>;
}

/**
 * Интерфейс генератора страниц
 */
/**
 * Конфигурация обработчика изображений
 */
export interface ImageProcessorConfig {
  proxyEnabled: boolean;
  proxyUrl: string;
  maxWidth: number;
  cacheEnabled: boolean;
  cacheTTL: number;
}

/**
 * Кэшированное изображение
 */
export interface CachedImage {
  url: string;
  timestamp: number;
}

/**
 * Контекст генерации всего документа
 */
export interface GenerationContext extends PageContext {
  imageUrls: string[];
  quote?: any;
}
