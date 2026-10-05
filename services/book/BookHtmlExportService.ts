import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/types/pdf-export';
import type { TravelDataTransformer } from '@/services/pdf-export/TravelDataTransformer';
import type { EnhancedPdfGenerator } from '@/services/pdf-export/generators/EnhancedPdfGenerator';
import { translate as i18nT } from '@/i18n'
import { addBookPrintChrome } from './bookPrintChrome'


export interface BookHtmlExportOptions {
  isPremium: boolean;
}

export class BookHtmlExportService {
  private dataTransformer: TravelDataTransformer | null = null;

  constructor() {
    this.dataTransformer = null;
  }

  async generateTravelsHtml(
    travels: Travel[],
    settings: BookSettings,
    options: BookHtmlExportOptions = { isPremium: true }
  ): Promise<string> {
    const transformer = await this.getTransformer();
    transformer.validate(travels);
    const travelsForBook = transformer.transform(travels);

    const html = await this.generateHtmlFromTravelsForBook(travelsForBook, settings, options);

    if (!html || html.trim().length === 0) {
      throw new Error(i18nT('export:services.book.BookHtmlExportService.sgenerirovannyy_html_knigi_pust_d0ce29f7'));
    }

    // Дополнительная защита: убеждаемся, что в документе есть страницы книги
    const hasPages = /class=["'][^"']*pdf-page[^"']*["']/.test(html);
    if (!hasPages) {
      throw new Error(i18nT('export:services.book.BookHtmlExportService.kniga_ne_soderzhit_ni_odnoy_stranitsy_dlya_p_3d57cec2'));
    }

    // Окно браузера получает панель «Печать», системный диалог приложений — нет.
    return addBookPrintChrome(html);
  }

  private async generateHtmlFromTravelsForBook(
    travelsForBook: TravelForBook[],
    settings: BookSettings,
    options: BookHtmlExportOptions
  ): Promise<string> {
    const generator = await this.getGenerator(settings.template);
    return await generator.generate(travelsForBook, settings, options);
  }

  private async getTransformer(): Promise<TravelDataTransformer> {
    if (this.dataTransformer) return this.dataTransformer;
    const mod = await import('@/services/pdf-export/TravelDataTransformer');
    this.dataTransformer = new mod.TravelDataTransformer();
    return this.dataTransformer;
  }

  private async getGenerator(template?: BookSettings['template']): Promise<EnhancedPdfGenerator> {
    const mod = await import('@/services/pdf-export/generators/EnhancedPdfGenerator');
    return new mod.EnhancedPdfGenerator(template || 'minimal');
  }
}
