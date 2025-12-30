// src/services/pdf-export/generators/v2/pages/PageGenerator.ts
// ✅ INTERFACE: Базовый интерфейс для генераторов страниц

import type { PageContext } from '../types';

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
  protected escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

