// src/services/pdf-export/generators/v2/EnhancedPdfGenerator.ts
// ✅ ОРКЕСТРАТОР: Главный генератор PDF v2 (модульная архитектура)

import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/src/types/pdf-export';
import { getThemeConfig, type PdfThemeName } from '../../themes/PdfThemeConfig';
import { ImageProcessor } from './processors/ImageProcessor';
import { HtmlBuilder } from './builders/HtmlBuilder';
import { StyleGenerator } from './builders/StyleGenerator';
import { CoverPageGenerator, TocPageGenerator, FinalPageGenerator } from './pages';
import { pickRandomQuote } from '../../quotes/travelQuotes';
import { defaultConfig } from './config/defaults';

// Импортируем старый генератор для делегирования
import { EnhancedPdfGenerator as V1Generator } from '../EnhancedPdfGenerator';

/**
 * Улучшенный генератор PDF v2
 * Использует модульную архитектуру с отдельными генераторами страниц
 */
export class EnhancedPdfGenerator {
  private theme: ReturnType<typeof getThemeConfig>;
  private imageProcessor: ImageProcessor;
  private htmlBuilder: HtmlBuilder;
  private styleGenerator: StyleGenerator;
  private v1Generator: V1Generator;

  constructor(themeName: PdfThemeName | string) {
    this.theme = getThemeConfig(themeName);
    this.imageProcessor = new ImageProcessor(defaultConfig.imageProcessor);
    this.htmlBuilder = new HtmlBuilder();
    this.styleGenerator = new StyleGenerator(this.theme);

    // Временно используем v1 для полной генерации
    this.v1Generator = new V1Generator(themeName);
  }

  /**
   * Генерирует HTML для PDF книги
   *
   * В текущей реализации делегируем к v1, но используем новые компоненты
   * для обложки, оглавления и финальной страницы.
   */
  async generate(
    travels: TravelForBook[],
    settings: BookSettings
  ): Promise<string> {
    // Пока делегируем к v1 для полной генерации
    // В следующих фазах будем постепенно переносить логику сюда
    return this.v1Generator.generate(travels, settings);
  }

  /**
   * Демонстрация новой архитектуры
   * Генерирует только обложку, оглавление и финальную страницу
   */
  async generateDemo(
    travels: TravelForBook[],
    settings: BookSettings
  ): Promise<string> {
    // Выбираем цитаты
    const coverQuote = pickRandomQuote();
    const finalQuote = pickRandomQuote(coverQuote);

    // Создаем генераторы страниц
    const coverGenerator = new CoverPageGenerator(this.imageProcessor, coverQuote);
    const tocGenerator = new TocPageGenerator([
      { travel: travels[0], startPage: 3 }
    ]);
    const finalGenerator = new FinalPageGenerator(finalQuote);

    // Генерируем страницы
    const context = {
      travels,
      settings,
      theme: this.theme,
      pageNumber: 1,
    };

    const coverPage = await coverGenerator.generate({ ...context, pageNumber: 1 });
    const tocPage = tocGenerator.generate({ ...context, pageNumber: 2 });
    const finalPage = finalGenerator.generate({ ...context, pageNumber: 3 });

    // Собираем HTML
    const styles = this.styleGenerator.generateGlobalStyles();

    return this.htmlBuilder
      .setStyles(styles)
      .addPage(coverPage)
      .addPage(tocPage)
      .addPage(finalPage)
      .build();
  }

  /**
   * Очищает кэш изображений
   */
  clearCache(): void {
    this.imageProcessor.clearCache();
  }
}

