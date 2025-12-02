import { Platform } from 'react-native';
import type { Travel } from '@/src/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { TravelDataTransformer } from '@/src/services/pdf-export/TravelDataTransformer';
import { EnhancedPdfGenerator } from '@/src/services/pdf-export/generators/EnhancedPdfGenerator';
import type { TravelForBook } from '@/src/types/pdf-export';

export class BookHtmlExportService {
  private dataTransformer: TravelDataTransformer;

  constructor() {
    this.dataTransformer = new TravelDataTransformer();
  }

  async generateTravelsHtml(
    travels: Travel[],
    settings: BookSettings
  ): Promise<string> {
    if (Platform.OS !== 'web') {
      throw new Error('Book HTML preview is only available on web');
    }

    this.dataTransformer.validate(travels);
    const travelsForBook = this.dataTransformer.transform(travels);

    const html = await this.generateHtmlFromTravelsForBook(travelsForBook, settings);

    if (!html || html.trim().length === 0) {
      throw new Error('Сгенерированный HTML книги пуст');
    }

    // Дополнительная защита: убеждаемся, что в документе есть страницы книги
    const hasPages = /class=["'][^"']*pdf-page[^"']*["']/.test(html);
    if (!hasPages) {
      // Логируем первые символы HTML для диагностики в консоли браузера
      if (typeof console !== 'undefined') {
        console.error('[BOOK_HTML_PREVIEW] HTML без .pdf-page, первые 500 символов:', html.slice(0, 500));
      }
      throw new Error('Книга не содержит ни одной страницы для печати. Попробуйте выбрать другие путешествия или изменить настройки.');
    }

    return this.enhanceHtmlForPrintPreview(html);
  }

  private async generateHtmlFromTravelsForBook(
    travelsForBook: TravelForBook[],
    settings: BookSettings
  ): Promise<string> {
    const generator = new EnhancedPdfGenerator(settings.template);
    return await generator.generate(travelsForBook, settings);
  }

  private enhanceHtmlForPrintPreview(html: string): string {
    let result = html;

    const toolbarHtml = `\n<div class="print-toolbar no-print" style="position:sticky;top:0;z-index:50;width:100%;background:rgba(15,23,42,0.96);color:#e5e7eb;padding:12px 24px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:14px;">\n  <div style="max-width:70%;">\n    Для сохранения книги в PDF используйте меню печати браузера (Ctrl/Cmd+P) и выберите «Сохранить как PDF».\n  </div>\n  <button onclick="window.print()" style="background:#f97316;border:none;border-radius:999px;color:#fff;padding:8px 16px;font-weight:600;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,0.3);">\n    Печать / Сохранить в PDF\n  </button>\n</div>\n`;

    const headIndex = result.indexOf('</head>');
    const bodyIndex = result.indexOf('<body');

    const toolbarStyles = `\n<style>\n  @media print {\n    .no-print { display: none !important; }\n    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n  }\n  @page { margin: 0; }\n</style>\n`;

    if (headIndex !== -1) {
      result = result.slice(0, headIndex) + toolbarStyles + result.slice(headIndex);
    } else {
      result = toolbarStyles + result;
    }

    const bodyTagEnd = result.indexOf('>', bodyIndex >= 0 ? bodyIndex : 0);
    if (bodyIndex !== -1 && bodyTagEnd !== -1) {
      const insertPos = bodyTagEnd + 1;
      result = result.slice(0, insertPos) + toolbarHtml + result.slice(insertPos);
    } else {
      result = toolbarHtml + result;
    }

    return result;
  }
}
