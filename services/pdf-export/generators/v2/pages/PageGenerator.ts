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

  /**
   * Строит изображение с blur-backdrop для сохранения пропорций без обрезки.
   */
  protected buildContainImage(
    src: string,
    alt: string,
    height: string,
    opts?: { onerrorBg?: string; filterStyle?: string }
  ): string {
    const bg = opts?.onerrorBg || '#f3f4f6';
    const filterStyle = opts?.filterStyle || '';
    return `
      <img src="${this.escapeHtml(src)}" alt="" aria-hidden="true"
        style="position:absolute;inset:-10px;width:calc(100% + 20px);height:calc(100% + 20px);object-fit:cover;filter:blur(18px);opacity:0.45;display:block;pointer-events:none;"
        crossorigin="anonymous" />
      <img src="${this.escapeHtml(src)}" alt="${this.escapeHtml(alt)}"
        style="position:relative;width:100%;height:${height};object-fit:contain;display:block;${filterStyle}"
        crossorigin="anonymous"
        onerror="this.style.display='none';this.previousElementSibling.style.display='none';this.parentElement.style.background='${bg}';" />
    `;
  }
}

