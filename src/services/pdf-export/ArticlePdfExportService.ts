// src/services/pdf-export/ArticlePdfExportService.ts
// Оркестратор экспорта одной статьи путешествия в PDF

import type { Travel } from '@/src/types/types';
import { ArticleParser } from './parsers/ArticleParser';
import { ArticlePdfGenerator, type ArticleExportSettings } from './generators/ArticlePdfGenerator';
import type { ArticlePdfModel } from '@/src/types/article-pdf';

export class ArticlePdfExportService {
  private parser: ArticleParser;

  constructor() {
    this.parser = new ArticleParser();
  }

  parseTravel(travel: Travel): ArticlePdfModel {
    return this.parser.parse(travel);
  }

  generateHtml(travel: Travel, settings: ArticleExportSettings): string {
    const model = this.parseTravel(travel);
    const generator = new ArticlePdfGenerator(settings.theme);
    return generator.generate(model, settings);
  }
}
