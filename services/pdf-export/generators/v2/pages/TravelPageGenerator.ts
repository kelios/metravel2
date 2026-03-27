// src/services/pdf-export/generators/v2/pages/TravelPageGenerator.ts
// ✅ GENERATOR: Генератор страниц путешествия (описание, контент, рекомендации)

import { BasePageGenerator } from './PageGenerator';
import type { PageContext } from '../types';
import { ContentParser } from '@/services/pdf-export/parsers/ContentParser';
import { BlockRenderer } from '@/services/pdf-export/renderers/BlockRenderer';
import { buildSafeImageUrl } from '../../../utils/htmlUtils';
import { formatDays } from '../../../utils/pluralize';
import { renderPdfIcon } from '../runtime/pdfVisualHelpers';
import { renderTravelPhotoPageMarkup } from '../runtime/travelPhotoPage';
import { renderTravelContentPageMarkup } from '../runtime/travelContentPage';

/**
 * Генератор страницы путешествия с контентом
 *
 * Генерирует:
 * - Страницу с большим фото (TravelPhotoPage)
 * - Страницу с текстом и QR кодом (TravelContentPage)
 */
export class TravelPageGenerator extends BasePageGenerator {
  private parser: ContentParser;

  constructor() {
    super();
    this.parser = new ContentParser();
  }

  /**
   * Генерирует обе страницы путешествия (фото + контент)
   */
  async generate(context: PageContext): Promise<string> {
    const { travel } = context;

    if (!travel) {
      throw new Error('TravelPageGenerator requires travel in context');
    }

    const photoPage = this.generatePhotoPage(context);
    const contentPage = this.generateContentPage(context);

    return photoPage + '\n' + contentPage;
  }

  /**
   * Оценивает количество страниц (фото + контент = 2)
   */
  estimatePageCount(_context: PageContext): number {
    return 2;
  }

  /**
   * Генерирует страницу с большим фото
   */
  private generatePhotoPage(context: PageContext): string {
    const { travel, theme } = context;

    if (!travel) return '';

    return renderTravelPhotoPageMarkup({
      travel,
      pageNumber: context.pageNumber,
      theme,
      layout: 'full-bleed',
      buildSafeImageUrl,
      escapeHtml: (value) => this.escapeHtml(value),
      formatDays,
      buildContainImage: (src, alt, height, opts) =>
        this.buildContainImage(src, alt, height, { onerrorBg: opts?.onerrorBg }),
      getImageFilterStyle: () => '',
    });
  }

  /**
   * Генерирует страницу с текстовым контентом
   */
  private generateContentPage(context: PageContext): string {
    const { travel, theme, pageNumber, metadata } = context;

    if (!travel) return '';

    const qrCode = metadata?.qrCode || '';

    // Описание рендерим через renderRichText (с умной раскладкой изображений)
    const descriptionHtml = travel.description
      ? this.renderRichText(travel.description, theme)
      : '';
    const recommendationBlocks = travel.recommendation
      ? this.parser.parse(travel.recommendation)
      : [];
    const plusBlocks = travel.plus ? this.parser.parse(travel.plus) : [];
    const minusBlocks = travel.minus ? this.parser.parse(travel.minus) : [];

    return renderTravelContentPageMarkup({
      travel,
      pageNumber,
      theme,
      qrCode,
      variant: 'standalone',
      descriptionHtml,
      recommendationBlocks: recommendationBlocks as any,
      plusBlocks: plusBlocks as any,
      minusBlocks: minusBlocks as any,
      renderBlocks: (blocks) => this.renderBlocks(blocks, theme),
      renderPdfIcon,
      escapeHtml: (value) => this.escapeHtml(value),
    });
  }

  /**
   * Рендерит сырой rich-text HTML через BlockRenderer (с умной раскладкой изображений)
   */
  private renderRichText(rawHtml: string, theme: any): string {
    if (typeof document !== 'undefined') {
      const blockRenderer = new BlockRenderer(theme);
      return blockRenderer.renderRichText(rawHtml);
    }
    // Fallback для серверной среды
    return rawHtml
      .split('\n\n')
      .map(para => `<p>${this.escapeHtml(para)}</p>`)
      .join('');
  }

  /**
   * Рендерит блоки контента
   */
  private renderBlocks(blocks: any[], theme: any): string {
    if (typeof document !== 'undefined') {
      const blockRenderer = new BlockRenderer(theme);
      return blockRenderer.renderBlocks(blocks);
    }
    // Fallback для серверной среды
    return blocks.map(block => {
      if (block.type === 'paragraph') {
        return `<p>${this.escapeHtml(block.content || block.data?.text || '')}</p>`;
      }
      return '';
    }).join('');
  }

}
