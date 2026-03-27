// src/services/pdf-export/generators/v2/EnhancedPdfGenerator.ts
// ✅ ОРКЕСТРАТОР: Главный генератор PDF v2 (модульная архитектура)

import type { PdfThemeName } from '../../themes/PdfThemeConfig';
import { ImageProcessor } from './processors/ImageProcessor';
import { defaultConfig } from './config/defaults';
import { EnhancedPdfGeneratorBase } from './runtime/EnhancedPdfGeneratorBase';

/**
 * Улучшенный генератор PDF v2
 * Использует модульную архитектуру с отдельными генераторами страниц
 *
 * Публичный канонический entrypoint PDF-генерации.
 * Полная orchestration/runtime-логика вынесена в runtime-base.
 */
export class EnhancedPdfGenerator extends EnhancedPdfGeneratorBase {
  private imageProcessor: ImageProcessor;

  constructor(themeName: PdfThemeName | string) {
    super(themeName);
    this.imageProcessor = new ImageProcessor(defaultConfig.imageProcessor);
  }

  /**
   * Очищает кэш изображений
   */
  clearCache(): void {
    this.imageProcessor.clearCache();
  }

  /**
   * Получает процессор изображений (для тестирования)
   */
  getImageProcessor(): ImageProcessor {
    return this.imageProcessor;
  }
}
