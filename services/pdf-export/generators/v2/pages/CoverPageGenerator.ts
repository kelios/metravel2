// src/services/pdf-export/generators/v2/pages/CoverPageGenerator.ts
// ✅ ГЕНЕРАТОР: Обложка книги путешествий

import { BasePageGenerator } from './PageGenerator';
import type { PageContext } from '../types';
import type { ImageProcessor } from '../processors/ImageProcessor';
import type { TravelQuote } from '../../../quotes/travelQuotes';
import {
  getYearRange as getBookYearRange,
  resolveCoverImage as resolveBookCoverImage,
} from '../runtime/bookData';
import { generateSharedCoverPageMarkup } from '../runtime/coverPage';

/**
 * Генератор обложки книги
 */
export class CoverPageGenerator extends BasePageGenerator {
  constructor(
    private imageProcessor?: ImageProcessor,
    private quote?: TravelQuote
  ) {
    super();
  }

  async generate(context: PageContext): Promise<string> {
    const { settings, travels = [], theme } = context;

    const userName = travels[0]?.userName || 'Аноним';
    const yearRange = getBookYearRange(travels);

    const coverImage = resolveBookCoverImage(travels, settings);
    const safeCoverImage =
      coverImage && this.imageProcessor ? await this.imageProcessor.processUrl(coverImage) : coverImage || undefined;

    return generateSharedCoverPageMarkup(theme, {
      title: settings.title,
      subtitle: settings.subtitle,
      userName,
      travelCount: travels.length,
      yearRange,
      coverImage: safeCoverImage,
      quote: this.quote && this.quote.author ? { text: this.quote.text, author: this.quote.author } : undefined,
      textPosition: 'auto',
      showDecorations: true,
    });
  }
}
