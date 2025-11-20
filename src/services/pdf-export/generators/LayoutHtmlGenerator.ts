// src/services/pdf-export/generators/LayoutHtmlGenerator.ts
// ✅ АРХИТЕКТУРА: Генератор HTML из пользовательского макета

import type { PdfLayout, LayoutBlock } from '@/src/types/pdf-layout';
import type { TravelForBook } from '@/src/types/pdf-export';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import QRCode from 'qrcode';

/**
 * Генератор HTML на основе пользовательского макета
 */
export class LayoutHtmlGenerator {
  /**
   * Генерирует HTML из макета и данных путешествий
   */
  async generate(
    layout: PdfLayout,
    travels: TravelForBook[],
    settings: BookSettings
  ): Promise<string> {
    const sortedTravels = this.sortTravels(travels, settings.sortOrder);
    const enabledBlocks = layout.blocks
      .filter(b => b.enabled)
      .sort((a, b) => a.order - b.order);

    const pages: string[] = [];
    const layoutMode = layout.layoutMode || 'flow';

    // Генерируем QR коды для путешествий
    const qrCodes = await this.generateQRCodes(sortedTravels);

    for (const block of enabledBlocks) {
      const blockHtml = await this.renderBlock(
        block,
        sortedTravels,
        settings,
        qrCodes,
        layoutMode
      );
      if (blockHtml) {
        pages.push(blockHtml);
      }
    }

    return this.buildHtmlDocument(pages, settings, layoutMode);
  }

  /**
   * Рендерит один блок
   */
  private async renderBlock(
    block: LayoutBlock,
    travels: TravelForBook[],
    settings: BookSettings,
    qrCodes: string[],
    layoutMode: 'flow' | 'page-per-block'
  ): Promise<string | null> {
    const pageBreak = block.pageBreak || (layoutMode === 'page-per-block' ? 'always' : 'auto');
    const pageBreakStyle = pageBreak === 'always' 
      ? 'page-break-before: always;' 
      : pageBreak === 'avoid' 
      ? 'page-break-inside: avoid;' 
      : '';

    switch (block.type) {
      case 'cover':
        return this.renderCover(settings, travels.length, pageBreakStyle);
      
      case 'toc':
        return this.renderToc(travels, settings, pageBreakStyle);
      
      case 'photo':
        return this.renderPhoto(travels[0], pageBreakStyle);
      
      case 'description':
        return this.renderDescription(travels[0], pageBreakStyle);
      
      case 'recommendation':
        return this.renderRecommendation(travels[0], pageBreakStyle);
      
      case 'plus':
        return this.renderPlus(travels[0], pageBreakStyle);
      
      case 'minus':
        return this.renderMinus(travels[0], pageBreakStyle);
      
      case 'gallery':
        return this.renderGallery(travels[0], block.config, pageBreakStyle);
      
      case 'map':
        return this.renderMap(travels[0], pageBreakStyle);
      
      case 'qr':
        return this.renderQR(travels[0], qrCodes[0] || '', pageBreakStyle);
      
      case 'spacer':
        return this.renderSpacer(block.config?.height || '20mm', pageBreakStyle);
      
      default:
        return null;
    }
  }

  /**
   * Рендерит обложку
   */
  private renderCover(
    settings: BookSettings,
    travelCount: number,
    pageBreak: string
  ): string {
    const travelLabel = travelCount === 1 ? 'путешествие' : travelCount < 5 ? 'путешествия' : 'путешествий';
    
    return `
      <section class="pdf-page cover-page" style="${pageBreak}">
        <div style="
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: center;
          background: linear-gradient(135deg, #ff9f5a 0%, #ff6b35 100%);
          color: #fff;
          padding: 40mm 30mm;
          text-align: center;
        ">
          <h1 style="font-size: 48pt; font-weight: 800; margin-bottom: 20mm; text-shadow: 0 4px 20px rgba(0,0,0,0.5);">
            ${this.escapeHtml(settings.title)}
          </h1>
          ${settings.subtitle ? `
            <div style="font-size: 18pt; margin-bottom: 16mm; opacity: 0.9;">
              ${this.escapeHtml(settings.subtitle)}
            </div>
          ` : ''}
          <div style="font-size: 24pt; font-weight: 600;">
            ${travelCount} ${travelLabel}
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Рендерит оглавление
   */
  private renderToc(
    travels: TravelForBook[],
    settings: BookSettings,
    pageBreak: string
  ): string {
    const tocItems = travels.map((travel, index) => `
      <div style="
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px dashed #ddd;
      ">
        <span style="font-size: 14pt; font-weight: 600;">
          ${index + 1}. ${this.escapeHtml(travel.name || 'Путешествие')}
        </span>
        <span style="color: #ff9f5a; font-weight: 700;">${index * 2 + 3}</span>
      </div>
    `).join('');

    return `
      <section class="pdf-page toc-page" style="${pageBreak}">
        <div style="padding: 30mm 25mm;">
          <h2 style="
            font-size: 32pt;
            font-weight: 800;
            text-align: center;
            margin-bottom: 20mm;
            color: #1f2937;
          ">Содержание</h2>
          <div style="margin-top: 20mm;">
            ${tocItems}
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Рендерит фото
   */
  private renderPhoto(travel: TravelForBook, pageBreak: string): string {
    const imageUrl = travel.travel_image_url || travel.travel_image_thumb_url || '';
    
    return `
      <section class="pdf-page photo-page" style="${pageBreak}">
        <div style="
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
        ">
          ${imageUrl ? `
            <img src="${this.escapeHtml(imageUrl)}" 
                 alt="${this.escapeHtml(travel.name || '')}"
                 style="
                   width: 100%;
                   height: 100%;
                   object-fit: cover;
                 "
                 crossorigin="anonymous" />
          ` : `
            <div style="
              width: 100%;
              height: 100%;
              background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="font-size: 24pt; color: #9ca3af;">Нет фото</div>
            </div>
          `}
          <div style="
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%);
            padding: 30mm 25mm;
            color: #fff;
          ">
            <h1 style="font-size: 36pt; font-weight: 800; margin-bottom: 10mm; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">
              ${this.escapeHtml(travel.name || 'Путешествие')}
            </h1>
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Рендерит описание
   */
  private renderDescription(travel: TravelForBook, pageBreak: string): string {
    const content = travel.description || 'Описание отсутствует';
    
    return `
      <section class="pdf-page description-page" style="${pageBreak}">
        <div style="padding: 30mm 25mm;">
          <h2 style="
            font-size: 24pt;
            font-weight: 700;
            color: #ff9f5a;
            margin-bottom: 15mm;
            border-left: 4px solid #ff9f5a;
            padding-left: 12px;
          ">Описание</h2>
          <div style="
            font-size: 12pt;
            line-height: 1.8;
            color: #374151;
            text-align: justify;
          ">
            ${this.sanitizeHtml(content)}
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Рендерит рекомендации
   */
  private renderRecommendation(travel: TravelForBook, pageBreak: string): string {
    const content = travel.recommendation || 'Рекомендации отсутствуют';
    
    return `
      <section class="pdf-page recommendation-page" style="${pageBreak}">
        <div style="padding: 30mm 25mm;">
          <h2 style="
            font-size: 24pt;
            font-weight: 700;
            color: #ff9f5a;
            margin-bottom: 15mm;
            border-left: 4px solid #ff9f5a;
            padding-left: 12px;
          ">Рекомендации</h2>
          <div style="
            font-size: 12pt;
            line-height: 1.8;
            color: #374151;
            text-align: justify;
          ">
            ${this.sanitizeHtml(content)}
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Рендерит плюсы
   */
  private renderPlus(travel: TravelForBook, pageBreak: string): string {
    const content = travel.plus || 'Плюсы отсутствуют';
    
    return `
      <section class="pdf-page plus-page" style="${pageBreak}">
        <div style="padding: 30mm 25mm;">
          <h2 style="
            font-size: 20pt;
            font-weight: 700;
            color: #166534;
            margin-bottom: 12mm;
          ">Плюсы</h2>
          <div style="
            font-size: 11pt;
            line-height: 1.8;
            color: #15803d;
            background: #dcfce7;
            padding: 15mm;
            border-radius: 12px;
            border: 2px solid #86efac;
          ">
            ${this.sanitizeHtml(content)}
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Рендерит минусы
   */
  private renderMinus(travel: TravelForBook, pageBreak: string): string {
    const content = travel.minus || 'Минусы отсутствуют';
    
    return `
      <section class="pdf-page minus-page" style="${pageBreak}">
        <div style="padding: 30mm 25mm;">
          <h2 style="
            font-size: 20pt;
            font-weight: 700;
            color: #991b1b;
            margin-bottom: 12mm;
          ">Минусы</h2>
          <div style="
            font-size: 11pt;
            line-height: 1.8;
            color: #dc2626;
            background: #fee2e2;
            padding: 15mm;
            border-radius: 12px;
            border: 2px solid #fca5a5;
          ">
            ${this.sanitizeHtml(content)}
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Рендерит галерею
   */
  private renderGallery(
    travel: TravelForBook,
    config: Record<string, any> | undefined,
    pageBreak: string
  ): string {
    const photos = (travel.gallery || []).map(item => 
      typeof item === 'string' ? item : item?.url
    ).filter(Boolean) as string[];

    if (photos.length === 0) {
      return `
        <section class="pdf-page gallery-page" style="${pageBreak}">
          <div style="padding: 30mm 25mm; text-align: center;">
            <div style="font-size: 18pt; color: #9ca3af;">Галерея пуста</div>
          </div>
        </section>
      `;
    }

    const imageSize = config?.imageSize || 'medium';
    const columns = config?.columns || 3;
    const selectedIndices = config?.selectedPhotos || [];
    const displayPhotos = selectedIndices.length > 0
      ? selectedIndices.map((i: number) => photos[i]).filter(Boolean)
      : photos;

    const sizeMap = {
      small: '60mm',
      medium: '80mm',
      large: '100mm',
    };
    const imageHeight = sizeMap[imageSize as keyof typeof sizeMap] || sizeMap.medium;

    const gridStyle = `
      display: grid;
      grid-template-columns: repeat(${columns}, 1fr);
      gap: 8mm;
      margin-top: 15mm;
    `;

    return `
      <section class="pdf-page gallery-page" style="${pageBreak}">
        <div style="padding: 30mm 25mm;">
          <h2 style="
            font-size: 24pt;
            font-weight: 700;
            text-align: center;
            margin-bottom: 10mm;
            color: #1f2937;
          ">Фотогалерея</h2>
          <div style="${gridStyle}">
            ${displayPhotos.map(photo => `
              <div style="
                width: 100%;
                height: ${imageHeight};
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              ">
                <img src="${this.escapeHtml(photo)}" 
                     alt="Photo"
                     style="
                       width: 100%;
                       height: 100%;
                       object-fit: cover;
                     "
                     crossorigin="anonymous" />
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Рендерит карту
   */
  private renderMap(travel: TravelForBook, pageBreak: string): string {
    return `
      <section class="pdf-page map-page" style="${pageBreak}">
        <div style="padding: 30mm 25mm;">
          <h2 style="
            font-size: 24pt;
            font-weight: 700;
            margin-bottom: 15mm;
            color: #1f2937;
          ">Карта маршрута</h2>
          <div style="
            width: 100%;
            height: 200mm;
            background: #f0f9ff;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #bae6fd;
          ">
            <div style="text-align: center; color: #0284c7;">
              <div style="font-size: 48pt; margin-bottom: 10mm;">🗺️</div>
              <div style="font-size: 16pt;">Карта маршрута</div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Рендерит QR код
   */
  private renderQR(travel: TravelForBook, qrCode: string, pageBreak: string): string {
    const url = travel.slug 
      ? `https://metravel.by/travels/${travel.slug}`
      : travel.url || '';

    return `
      <section class="pdf-page qr-page" style="${pageBreak}">
        <div style="padding: 30mm 25mm; display: flex; align-items: center; justify-content: center; flex-direction: column;">
          <h2 style="
            font-size: 24pt;
            font-weight: 700;
            margin-bottom: 20mm;
            color: #1f2937;
          ">Онлайн-версия</h2>
          ${qrCode ? `
            <img src="${qrCode}" 
                 alt="QR Code"
                 style="
                   width: 80mm;
                   height: 80mm;
                   border: 4px solid #fff;
                   box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                   margin-bottom: 15mm;
                 " />
          ` : ''}
          <div style="
            font-size: 10pt;
            color: #6b7280;
            word-break: break-all;
            text-align: center;
            max-width: 120mm;
          ">
            ${this.escapeHtml(url)}
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Рендерит отступ
   */
  private renderSpacer(height: string, pageBreak: string): string {
    return `
      <section class="pdf-page spacer-page" style="${pageBreak}">
        <div style="height: ${height};"></div>
      </section>
    `;
  }

  /**
   * Собирает HTML документ
   */
  private buildHtmlDocument(
    pages: string[],
    settings: BookSettings,
    layoutMode: 'flow' | 'page-per-block'
  ): string {
    return `
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${this.escapeHtml(settings.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background: #f5f5f5;
    }
    .pdf-page {
      width: 210mm;
      min-height: 297mm;
      background: #fff;
      margin: 0 auto ${layoutMode === 'page-per-block' ? '0' : '16px'};
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      position: relative;
      page-break-after: ${layoutMode === 'page-per-block' ? 'always' : 'auto'};
    }
    img {
      max-width: 100%;
      display: block;
      height: auto;
    }
    @media print {
      body { background: #fff; }
      .pdf-page {
        page-break-after: always;
        box-shadow: none;
        margin: 0 auto;
      }
    }
  </style>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>
    `;
  }

  /**
   * Генерирует QR коды
   */
  private async generateQRCodes(travels: TravelForBook[]): Promise<string[]> {
    return Promise.all(
      travels.map(async (travel) => {
        const url = travel.slug 
          ? `https://metravel.by/travels/${travel.slug}`
          : travel.url || '';
        
        if (!url) return '';
        
        try {
          return await QRCode.toDataURL(url, { width: 300 });
        } catch {
          return '';
        }
      })
    );
  }

  /**
   * Сортирует путешествия
   */
  private sortTravels(
    travels: TravelForBook[],
    sortOrder: BookSettings['sortOrder']
  ): TravelForBook[] {
    const sorted = [...travels];
    switch (sortOrder) {
      case 'date-desc':
        return sorted.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
      case 'date-asc':
        return sorted.sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0));
      case 'alphabetical':
        return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      default:
        return sorted;
    }
  }

  private escapeHtml(text: string): string {
    if (typeof text !== 'string') return String(text);
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private sanitizeHtml(html: string): string {
    // Простая санитизация - можно улучшить
    return html
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/on\w+="[^"]*"/gi, '');
  }
}

