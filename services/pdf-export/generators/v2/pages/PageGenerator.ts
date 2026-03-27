// src/services/pdf-export/generators/v2/pages/PageGenerator.ts
// ✅ INTERFACE: Базовый интерфейс для генераторов страниц

import type { PageContext } from '../types';
import { escapeHtml as sharedEscapeHtml } from '../../../utils/htmlUtils';
import { buildContainImageMarkup } from '../runtime/pdfVisualHelpers';

/**
 * Базовый интерфейс для всех генераторов страниц
 */
export interface PageGenerator {
  /**
   * Генерирует HTML страницу
   */
  generate(context: PageContext): string | Promise<string>;

  /**
   * Оценивает количество страниц (для оглавления)
   */
  estimatePageCount(context: PageContext): number;
}

/**
 * Абстрактный базовый класс для генераторов страниц
 */
export abstract class BasePageGenerator implements PageGenerator {
  abstract generate(context: PageContext): string | Promise<string>;

  estimatePageCount(_context: PageContext): number {
    return 1;
  }

  /**
   * Экранирование HTML
   */
  protected escapeHtml(text: string | null | undefined): string {
    return sharedEscapeHtml(text);
  }

  /**
   * Строит изображение с blur-backdrop для сохранения пропорций без обрезки.
   */
  protected buildContainImage(
    src: string,
    alt: string,
    height: string,
    opts?: { onerrorBg?: string; filterStyle?: string }
  ): string {
    return buildContainImageMarkup({
      src,
      alt,
      height,
      background: opts?.onerrorBg || '#f3f4f6',
      filterStyle: opts?.filterStyle || '',
      backdropMode: 'blur',
    });
  }
}
