// src/services/pdf-export/generators/v2/EnhancedPdfGenerator.ts
// ✅ ОРКЕСТРАТОР: Главный генератор PDF v2 (модульная архитектура)

import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/types/pdf-export';
import { getThemeConfig, type PdfThemeName } from '../../themes/PdfThemeConfig';
import { ImageProcessor } from './processors/ImageProcessor';
import { HtmlBuilder } from './builders/HtmlBuilder';
import { StyleGenerator } from './builders/StyleGenerator';
import { PageGeneratorFactory } from './factories/PageGeneratorFactory';
import { pickRandomQuote } from '../../quotes/travelQuotes';
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
  private v2Theme: ReturnType<typeof getThemeConfig>;
  private imageProcessor: ImageProcessor;
  private htmlBuilder: HtmlBuilder;
  private styleGenerator: StyleGenerator;
  private factory: PageGeneratorFactory;

  constructor(themeName: PdfThemeName | string) {
    super(themeName);
    this.v2Theme = getThemeConfig(themeName);
    this.imageProcessor = new ImageProcessor(defaultConfig.imageProcessor);
    this.htmlBuilder = new HtmlBuilder();
    this.styleGenerator = new StyleGenerator(this.v2Theme);
    this.factory = new PageGeneratorFactory(this.imageProcessor);
  }

  /**
   * ✅ ДЕМО: Генерация только с использованием новых компонентов v2
   * Показывает, как работают все генераторы через фабрику
   */
  async generateV2Demo(
    _travels: TravelForBook[],
    _settings: BookSettings
  ): Promise<string> {
    // Выбираем случайные цитаты
    const coverQuote = pickRandomQuote();
    const finalQuote = pickRandomQuote(coverQuote);
    void coverQuote;
    void finalQuote;

    const pages: string[] = [];

    // Демонстрация использования фабрики для создания страниц
    // Здесь показан принцип работы - в production будет полная реализация

    this.htmlBuilder.reset();
    const styles = this.styleGenerator.generateGlobalStyles();
    this.htmlBuilder.setStyles(styles);

    // Добавляем демо-страницы
    pages.forEach(page => this.htmlBuilder.addPage(page));

    return this.htmlBuilder.build();
  }

  /**
   * Очищает кэш изображений
   */
  clearCache(): void {
    this.imageProcessor.clearCache();
  }

  /**
   * Получает фабрику генераторов (для тестирования)
   */
  getFactory(): PageGeneratorFactory {
    return this.factory;
  }

  /**
   * Получает процессор изображений (для тестирования)
   */
  getImageProcessor(): ImageProcessor {
    return this.imageProcessor;
  }
}
