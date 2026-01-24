// src/services/pdf-export/generators/EnhancedPdfGenerator.ts
// ✅ АРХИТЕКТУРА: Улучшенный генератор PDF с новой системой тем и парсером

import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/src/types/pdf-export';
import type { GalleryLayout, CaptionPosition } from '@/src/types/pdf-gallery';
import { calculateOptimalColumns } from '@/src/types/pdf-gallery';
import { getThemeConfig, type PdfThemeName } from '../themes/PdfThemeConfig';
import type { ContentParser, ParsedContentBlock } from '../parsers/ContentParser';
import type { BlockRenderer } from '../renderers/BlockRenderer';
import type { TravelQuote } from '../quotes/travelQuotes';
import { pickRandomGalleryQuote, pickRandomQuote } from '../quotes/travelQuotes';
import { CoverPageGenerator } from './pages/CoverPageGenerator';

const CHECKLIST_LIBRARY: Record<BookSettings['checklistSections'][number], string[]> = {
  clothing: ['Термобельё', 'Тёплый слой/флис', 'Дождевик/пончо', 'Треккинговая обувь', 'Шапка, перчатки, бафф'],
  food: ['Перекусы', 'Термос', 'Походная посуда', 'Мультитул/нож', 'Фильтр или запас воды'],
  electronics: ['Повербанк', 'Камера/GoPro', 'Переходники', 'Налобный фонарь', 'Запасные карты памяти'],
  documents: ['Паспорт', 'Билеты/бронирования', 'Страховка', 'Водительские права', 'Список контактов'],
  medicine: ['Индивидуальные лекарства', 'Пластыри и бинт', 'Средство от насекомых', 'Солнцезащита', 'Антисептик'],
};

const CHECKLIST_LABELS: Record<BookSettings['checklistSections'][number], string> = {
  clothing: 'Одежда',
  food: 'Еда',
  electronics: 'Электроника',
  documents: 'Документы',
  medicine: 'Аптечка',
};

/**
 * Генератор улучшенного PDF
 */
export class EnhancedPdfGenerator {
  private parser: ContentParser | null = null;
  private blockRenderer: BlockRenderer | null = null;
  private theme: ReturnType<typeof getThemeConfig>;
  private selectedQuotes?: { cover?: TravelQuote; final?: TravelQuote };
  private galleryQuotesByTravel = new Map<string | number, TravelQuote>();
  private currentSettings?: BookSettings;

  private getGalleryOptions(): {
    layout: GalleryLayout;
    columns?: number;
    showCaptions: boolean;
    captionPosition: CaptionPosition;
    spacing: NonNullable<BookSettings['gallerySpacing']>;
  } {
    const settings = this.currentSettings;

    const layout = (settings?.galleryLayout || 'grid') as GalleryLayout;
    const spacing = (settings?.gallerySpacing || 'normal') as NonNullable<BookSettings['gallerySpacing']>;
    const showCaptions = settings?.showCaptions !== false;
    const captionPosition = (settings?.captionPosition || 'bottom') as CaptionPosition;
    const columns = typeof settings?.galleryColumns === 'number' ? settings.galleryColumns : undefined;

    return {
      layout,
      columns,
      showCaptions,
      captionPosition,
      spacing,
    };
  }

  private getGalleryPhotosPerPage(
    layout: GalleryLayout,
    totalPhotos: number,
    settings: BookSettings | undefined = this.currentSettings
  ): number {
    if (layout === 'slideshow') return 1;
    const configured = settings?.galleryPhotosPerPage;
    if (configured === 0) return totalPhotos;
    if (typeof configured === 'number' && configured > 0) {
      return Math.min(totalPhotos, Math.max(1, configured));
    }
    return totalPhotos;
  }

  private getGalleryGapMm(spacing: NonNullable<BookSettings['gallerySpacing']>): number {
    switch (spacing) {
      case 'compact':
        return 3;
      case 'spacious':
        return 8;
      case 'normal':
      default:
        return 6;
    }
  }

  private buildGalleryCaption(
    index: number,
    position: CaptionPosition,
    typography: ReturnType<typeof getThemeConfig>['typography']
  ): { wrapperStart: string; wrapperEnd: string } {
    if (position === 'none') {
      return { wrapperStart: '', wrapperEnd: '' };
    }

    const text = `Фото ${index + 1}`;

    if (position === 'overlay') {
      return {
        wrapperStart: `
          <div style="
            position: absolute;
            left: 8px;
            bottom: 8px;
            right: 8px;
            padding: 6px 10px;
            background: rgba(0,0,0,0.65);
            color: #fff;
            border-radius: 10px;
            font-size: ${typography.caption.size};
            line-height: 1.25;
            font-weight: 600;
            z-index: 2;
          ">${this.escapeHtml(text)}`, 
        wrapperEnd: `</div>`,
      };
    }

    const top = position === 'top';
    return {
      wrapperStart: `
        <div style="
          padding: 8px 10px;
          color: ${this.theme.colors.textMuted};
          font-size: ${typography.caption.size};
          font-weight: 600;
          font-family: ${typography.bodyFont};
          ${top ? 'border-bottom' : 'border-top'}: 1px solid ${this.theme.colors.border};
          background: ${this.theme.colors.surface};
        ">${this.escapeHtml(text)}`, 
      wrapperEnd: `</div>`,
    };
  }

  private getGalleryQuote(travel: TravelForBook): TravelQuote {
    const key = travel.id ?? travel.name ?? 'default';
    if (!this.galleryQuotesByTravel.has(key)) {
      const quote = pickRandomGalleryQuote();
      this.galleryQuotesByTravel.set(key, {
        text: quote.text,
        author: quote.author || 'MeTravel.by',
      });
    }
    return this.galleryQuotesByTravel.get(key)!;
  }

  constructor(themeName: PdfThemeName | string) {
    this.theme = getThemeConfig(themeName);
  }

  /**
   * Генерирует HTML для PDF книги
   */
  async generate(
    travels: TravelForBook[],
    settings: BookSettings
  ): Promise<string> {
    await this.ensureParser();
    await this.ensureBlockRenderer();
    this.currentSettings = settings;

    const sortedTravels = this.sortTravels(travels, settings.sortOrder);
    const coverImage = this.resolveCoverImage(sortedTravels, settings);
    const yearRange = this.getYearRange(sortedTravels);
    const userName = sortedTravels[0]?.userName || 'Аноним';

    if (!this.selectedQuotes) {
      const coverQuote = pickRandomQuote();
      const finalQuote = pickRandomQuote(coverQuote);
      this.selectedQuotes = { cover: coverQuote, final: finalQuote };
    }

    // Генерируем QR коды
    const qrCodes = await this.generateQRCodes(sortedTravels);

    // Собираем метаданные для оглавления
    const meta = this.buildTravelMeta(sortedTravels, settings);
    
    // Генерируем страницы
    const pages: string[] = [];
    let currentPage = settings.includeToc ? 3 : 2;

    // Обложка с улучшенным дизайном
    const coverGenerator = new CoverPageGenerator(this.theme);
    const coverQuote = this.selectedQuotes?.cover;
    const coverPage = await coverGenerator.generate({
      title: settings.title,
      subtitle: settings.subtitle,
      userName,
      travelCount: sortedTravels.length,
      yearRange,
      coverImage,
      quote: coverQuote && coverQuote.author ? { text: coverQuote.text, author: coverQuote.author } : undefined,
      textPosition: 'auto',
      showDecorations: true,
    });
    pages.push(coverPage);

    // Оглавление
    if (settings.includeToc) {
      pages.push(this.renderTocPage(meta, 2));
      currentPage = 3;
    } else {
      currentPage = 2;
    }

    // Страницы путешествий
    for (let index = 0; index < meta.length; index++) {
      const item = meta[index];
      const travel = item.travel;

      // Страница с большим обложечным фото
      pages.push(this.renderTravelPhotoPage(travel, currentPage));
      currentPage++;

      // Страница с текстом и inline-галереями (фото «внутри» статьи)
      pages.push(this.renderTravelContentPage(travel, qrCodes[index], currentPage));
      currentPage++;

      // Отдельная страница галереи (все фото), если включено в настройках
      if (item.hasGallery) {
        const galleryPages = this.renderGalleryPages(travel, currentPage);
        pages.push(...galleryPages);
        currentPage += galleryPages.length;
      }

      // Карта (DOM-скриншот Leaflet, только в браузере)
      if (item.hasMap) {
        const mapPage = await this.renderMapPage(travel, item.locations, currentPage);
        pages.push(mapPage);
        currentPage++;
      }
    }

    if (settings.includeChecklists) {
      const checklistPage = this.renderChecklistPage(settings, currentPage);
      if (checklistPage) {
        pages.push(checklistPage);
        currentPage++;
      }
    }

    // Финальная страница
    pages.push(this.renderFinalPage(currentPage));

    // Собираем HTML
    return this.buildHtmlDocument(pages, settings);
  }

  /**
   * Рендерит обложку
   */
  private renderCoverPage(
    settings: BookSettings,
    userName: string,
    travelCount: number,
    yearRange?: string,
    coverImage?: string
  ): string {
    const { colors, typography } = this.theme;
    const safeTitle = (settings.title || '').trim();
    const travelLabel = this.getTravelLabel(travelCount);
    const safeCoverImage = this.buildSafeImageUrl(coverImage);
    const coverQuote = this.selectedQuotes?.cover;

    const background = `linear-gradient(135deg, ${colors.cover.backgroundGradient[0]} 0%, ${colors.cover.backgroundGradient[1]} 100%)`;

    return `
      <section class="pdf-page cover-page" style="
        padding: 0;
        height: 285mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        color: ${colors.cover.text};
        background: ${background};
        position: relative;
        overflow: hidden;
      ">
        ${safeCoverImage ? `
          <img
            class="cover-bg-blur"
            src="${this.escapeHtml(safeCoverImage)}"
            alt=""
            aria-hidden="true"
            crossorigin="anonymous"
            style="
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              object-fit: contain;
              object-position: center;
              filter: blur(18px);
              transform: scale(1.08);
              opacity: 0.75;
              z-index: 0;
            "
          />
          <img
            class="cover-bg-main"
            src="${this.escapeHtml(safeCoverImage)}"
            alt=""
            aria-hidden="true"
            crossorigin="anonymous"
            style="
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              object-fit: contain;
              object-position: center;
              z-index: 1;
              ${this.getImageFilterStyle()}
            "
          />
          <div style="
            position: absolute;
            inset: 0;
            background:
              radial-gradient(ellipse at center, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.50) 70%, rgba(0,0,0,0.75) 100%),
              linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.10) 45%, rgba(0,0,0,0.70) 100%);
            z-index: 2;
          "></div>
        ` : ''}

        <div style="
          padding: 26mm 24mm 0 24mm;
          text-align: center;
          position: relative;
          z-index: 3;
        ">
          <div style="
            display: inline-block;
            max-width: 160mm;
            padding: 10mm 12mm;
            border-radius: 14px;
            background: rgba(0,0,0,0.28);
            border: 1px solid rgba(255,255,255,0.14);
            box-shadow: 0 16px 40px rgba(0,0,0,0.35);
          ">
            ${safeTitle ? `
              <h1 style="
                color: ${colors.cover.text};
                font-size: ${typography.h1.size};
                font-weight: ${typography.h1.weight};
                line-height: ${typography.h1.lineHeight};
                margin: 0;
                text-shadow: 0 10px 30px rgba(0,0,0,0.35);
                font-family: ${typography.headingFont};
                overflow-wrap: normal;
                word-break: normal;
                hyphens: none;
              ">${this.escapeHtml(safeTitle)}</h1>
            ` : ''}

            ${settings.subtitle ? `
              <div style="
                font-size: 16pt;
                letter-spacing: 0.02em;
                color: rgba(255,255,255,0.90);
                margin-top: 5mm;
                font-family: ${typography.bodyFont};
                overflow-wrap: normal;
                word-break: normal;
                hyphens: none;
              ">${this.escapeHtml(settings.subtitle)}</div>
            ` : ''}
          </div>

          <div style="
            font-size: 12pt;
            opacity: 0.85;
            margin-top: 10mm;
            font-family: ${typography.bodyFont};
            overflow-wrap: anywhere;
            word-break: break-word;
            hyphens: auto;
          ">${this.escapeHtml(userName)}</div>

          ${coverQuote ? `
            <div style="
              margin-top: 14mm;
              max-width: 120mm;
              margin-left: auto;
              margin-right: auto;
              font-size: 11pt;
              line-height: 1.6;
              color: rgba(255,255,255,0.9);
              font-style: italic;
              font-family: ${typography.bodyFont};
              overflow-wrap: anywhere;
              word-break: break-word;
              hyphens: auto;
            ">
              «${this.escapeHtml(coverQuote.text)}»
              <div style="
                margin-top: 3mm;
                font-size: 9pt;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                opacity: 0.9;
                overflow-wrap: anywhere;
                word-break: break-word;
                hyphens: auto;
              ">
                ${this.escapeHtml(coverQuote.author || 'MeTravel.by')}
              </div>
            </div>
          ` : ''}
        </div>

        <div style="
          padding: 0 24mm 24mm 24mm;
          position: relative;
          z-index: 3;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 10mm;
        ">
          <div style="
            font-size: 11pt;
            letter-spacing: 0.04em;
            color: rgba(255,255,255,0.85);
            font-weight: 500;
            overflow-wrap: anywhere;
            word-break: break-word;
            hyphens: auto;
          ">
            ${this.escapeHtml(String(travelCount))} ${travelLabel}${yearRange ? ` • ${this.escapeHtml(yearRange)}` : ''}
          </div>
          <div style="
            font-size: 10pt;
            opacity: 0.7;
            font-weight: 500;
            letter-spacing: 0.08em;
            font-family: ${typography.bodyFont};
          ">MeTravel.by</div>
        </div>

        <div style="
          position: absolute;
          bottom: 10mm;
          left: 24mm;
          font-size: 9pt;
          opacity: 0.7;
          z-index: 3;
          font-family: ${typography.bodyFont};
        ">
          Создано ${new Date().toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </section>
    `;
  }

  /**
   * Строит inline-галерею для текстовой страницы (1-4 фото встраиваются компактно)
   * Для 5+ фото рекомендуется отдельная страница галереи
   */
  private buildInlineGallerySection(
    travel: TravelForBook,
    colors: ReturnType<typeof getThemeConfig>['colors'],
    typography: ReturnType<typeof getThemeConfig>['typography'],
    spacing: ReturnType<typeof getThemeConfig>['spacing']
  ): string {
    const rawPhotos = travel.gallery || [];
    const photos = rawPhotos
      .map((item) => {
        const url = typeof item === 'string' ? item : item?.url;
        return this.buildSafeImageUrl(url);
      })
      .filter((url): url is string => !!url && url.trim().length > 0);

    if (!photos.length) return '';

    // Для 5+ фото показываем только превью с указанием на отдельную страницу галереи
    if (photos.length >= 5) {
      const previewPhotos = photos.slice(0, 4);
      const remaining = photos.length - 4;
      
      return `
        <div style="margin-bottom: ${spacing.sectionSpacing};">
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: ${spacing.elementSpacing};
            padding-bottom: 8px;
            border-bottom: 2px solid ${colors.accentSoft};
          ">
            ${this.renderPdfIcon('camera', colors.text, 20)}
            <h2 style="
              font-size: ${typography.h2.size};
              font-weight: ${typography.h2.weight};
              color: ${colors.accent};
              margin: 0;
              font-family: ${typography.headingFont};
            ">Фотогалерея</h2>
            <span style="
              font-size: ${typography.small.size};
              color: ${colors.textMuted};
              font-family: ${typography.bodyFont};
            ">(${photos.length} ${this.getPhotoLabel(photos.length)})</span>
          </div>
          <div style="
            display: flex;
            gap: 4mm;
            flex-wrap: nowrap;
          ">
            ${previewPhotos.map((photo, index) => `
              <div style="
                width: calc((100% - 12mm) / 4);
                border-radius: ${this.theme.blocks.borderRadius};
                overflow: hidden;
                background: ${colors.surfaceAlt};
                box-shadow: ${this.theme.blocks.shadow};
                position: relative;
              ">
                <img src="${this.escapeHtml(photo)}" alt="Фото ${index + 1}"
                  style="width: 100%; height: 48mm; object-fit: contain; display: block; ${this.getImageFilterStyle()}"
                  crossorigin="anonymous"
                  onerror="this.style.display='none'; this.parentElement.style.background='${colors.surfaceAlt}';" />
                ${index === 3 ? `
                  <div style="
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.7);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24pt;
                    font-weight: 700;
                    font-family: ${typography.headingFont};
                  ">+${remaining}</div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    const { layout, columns: configuredColumns, showCaptions, captionPosition, spacing: gallerySpacing } =
      this.getGalleryOptions();

    const gapMm = this.getGalleryGapMm(gallerySpacing);

    // Для 1-4 фото: компактная встроенная галерея
    if (photos.length === 1) {
      const caption = showCaptions ? this.buildGalleryCaption(0, captionPosition, typography) : null;
      return `
        <div style="margin-bottom: ${spacing.sectionSpacing};">
          <div style="
            border-radius: ${this.theme.blocks.borderRadius};
            overflow: hidden;
            box-shadow: ${this.theme.blocks.shadow};
            background: ${colors.surfaceAlt};
            position: relative;
          ">
            <img src="${this.escapeHtml(photos[0])}" alt="Фото путешествия"
              style="width: 100%; height: 85mm; object-fit: contain; display: block; ${this.getImageFilterStyle()}"
              crossorigin="anonymous"
              onerror="this.style.display='none'; this.parentElement.style.background='${colors.surfaceAlt}';" />
            ${caption && captionPosition === 'overlay' ? caption.wrapperStart + caption.wrapperEnd : ''}
          </div>
        </div>
      `;
    }

    // Для 2-4 фото: сетка
    const defaultColumns = photos.length === 2 ? 2 : photos.length === 3 ? 3 : 2;
    const gridColumns =
      layout === 'grid' || layout === 'masonry'
        ? Math.max(1, Math.min(4, configuredColumns ?? defaultColumns))
        : defaultColumns;
    const imageHeight = gridColumns >= 3 ? '55mm' : '62mm';

    return `
      <div style="margin-bottom: ${spacing.sectionSpacing};">
        <div style="
          display: grid;
          grid-template-columns: repeat(${gridColumns}, 1fr);
          gap: ${gapMm}mm;
        ">
          ${photos
            .map((photo, index) => {
              const caption = showCaptions ? this.buildGalleryCaption(index, captionPosition, typography) : null;
              return `
            <div style="
              border-radius: ${this.theme.blocks.borderRadius};
              overflow: hidden;
              background: ${colors.surfaceAlt};
              box-shadow: ${this.theme.blocks.shadow};
              position: relative;
              ${layout === 'polaroid' ? `padding: 6mm 6mm 10mm 6mm; background: #fff;` : ''}
              ${layout === 'polaroid' ? `transform: rotate(${index % 2 === 0 ? '-1.2deg' : '1.1deg'});` : ''}
            ">
              ${caption && captionPosition === 'top' ? caption.wrapperStart + caption.wrapperEnd : ''}
              <img src="${this.escapeHtml(photo)}" alt="Фото ${index + 1}"
                style="width: 100%; height: ${imageHeight}; object-fit: contain; display: block; ${this.getImageFilterStyle()}"
                crossorigin="anonymous"
                onerror="this.style.display='none'; this.parentElement.style.background='${colors.surfaceAlt}';" />
              ${caption && captionPosition === 'overlay' ? caption.wrapperStart + caption.wrapperEnd : ''}
              ${caption && captionPosition === 'bottom' ? caption.wrapperStart + caption.wrapperEnd : ''}
            </div>
          `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  /**
   * Рендерит оглавление
   */
  private renderTocPage(meta: TravelSectionMeta[], pageNumber: number): string {
    const { colors, typography, spacing } = this.theme;
    const tocItems = meta
      .map((item, index) => {
        const travel = item.travel;

        const country = travel.countryName ? this.escapeHtml(travel.countryName) : '';
        const year = travel.year ? this.escapeHtml(String(travel.year)) : '';
        const metaLineParts = [country, year].filter(Boolean);
        const metaLine = metaLineParts.join(' • ');

        return `
          <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 18px;
            background: ${colors.surface};
            border-radius: ${this.theme.blocks.borderRadius};
            border: ${this.theme.blocks.borderWidth} solid ${colors.border};
            box-shadow: ${this.theme.blocks.shadow};
          ">
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-weight: 600;
                font-size: 14pt;
                margin-bottom: 4px;
                color: ${colors.text};
                line-height: 1.3;
                font-family: ${typography.headingFont};
              ">${index + 1}. ${this.escapeHtml(travel.name)}</div>
              ${metaLine ? `
                <div style="
                  font-size: 10.5pt;
                  color: ${colors.textMuted};
                  font-family: ${typography.bodyFont};
                ">${metaLine}</div>
              ` : ''}
            </div>
            <div style="
              margin-left: 18px;
              font-weight: 700;
              color: ${colors.accent};
              font-size: 18pt;
              flex-shrink: 0;
              display: flex;
              align-items: center;
              font-family: ${typography.headingFont};
            ">${item.startPage}</div>
          </div>
        `;
      })
      .join('');

    return `
      <section class="pdf-page toc-page" style="
        padding: ${spacing.pagePadding};
        background: ${colors.background};
      ">
        <div style="
          text-align: center;
          margin-top: 24mm;
          margin-bottom: 16mm;
        ">
          <h2 style="
            font-size: ${typography.h1.size};
            margin-bottom: 6px;
            font-weight: ${typography.h1.weight};
            color: ${colors.text};
            letter-spacing: -0.02em;
            font-family: ${typography.headingFont};
          ">Содержание</h2>
          <p style="
            color: ${colors.textMuted};
            font-size: ${typography.body.size};
            font-family: ${typography.bodyFont};
            margin: 0 0 10px 0;
          ">${meta.length} ${this.getTravelLabel(meta.length)}</p>
          <div style="
            width: 60mm;
            height: 2px;
            margin: 0 auto;
            background-color: ${colors.accent};
            border-radius: 999px;
          "></div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${tocItems}
        </div>
        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: ${typography.caption.size};
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
        ">${pageNumber}</div>
      </section>
    `;
  }

  private buildGoogleMapsUrl(location: NormalizedLocation): string {
    if (typeof location.lat !== 'number' || typeof location.lng !== 'number') return '';
    const query = `${location.lat},${location.lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  private async generateLocationQRCodes(locations: NormalizedLocation[]): Promise<string[]> {
    const QRCode = await this.getQRCode();
    return Promise.all(
      locations.map(async (loc) => {
        const url = this.buildGoogleMapsUrl(loc);
        if (!url) return '';
        try {
          return await QRCode.toDataURL(url, { margin: 1, scale: 4, width: 140 });
        } catch {
          return '';
        }
      })
    );
  }

  /**
   * Рендерит страницу с фото путешествия
   */
  private renderTravelPhotoPage(travel: TravelForBook, pageNumber: number): string {
    const { colors, typography, spacing } = this.theme;
    const coverImage = this.buildSafeImageUrl(
      travel.travel_image_url || travel.travel_image_thumb_url
    );
    
    const metaPieces = [
      travel.countryName ? this.escapeHtml(travel.countryName) : null,
      travel.year ? this.escapeHtml(String(travel.year)) : null,
      this.formatDays(travel.number_days),
    ].filter(Boolean);

    return `
      <section class="pdf-page travel-photo-page" style="padding: ${spacing.pagePadding};">
        ${coverImage ? `
          <div style="
            border-radius: ${this.theme.blocks.borderRadius};
            overflow: hidden;
            position: relative;
            box-shadow: ${this.theme.blocks.shadow};
            height: 100%;
            min-height: 235mm;
          ">
            <img src="${this.escapeHtml(coverImage)}" alt="${this.escapeHtml(travel.name)}"
              style="
                width: 100%;
                height: 100%;
                object-fit: contain;
                display: block;
                ${this.getImageFilterStyle()}
              "
              crossorigin="anonymous"
              onerror="this.style.display='none'; this.parentElement.style.background='${colors.accentSoft}';" />
            <div style="
              position: absolute;
              left: 0;
              right: 0;
              bottom: 0;
              background:
                linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.78) 100%);
              padding: 16mm 18mm 14mm 18mm;
            ">
              <div style="
                display: inline-block;
                max-width: 165mm;
                padding: 8mm 10mm;
                border-radius: 14px;
                background: rgba(0,0,0,0.30);
                border: 1px solid rgba(255,255,255,0.14);
              ">
                <h1 style="
                  color: #ffffff;
                  font-size: ${typography.h1.size};
                  margin: 0 0 5mm 0;
                  font-weight: ${typography.h1.weight};
                  line-height: ${typography.h1.lineHeight};
                  text-shadow: 0 6px 18px rgba(0,0,0,0.55);
                  font-family: ${typography.headingFont};
                  overflow-wrap: normal;
                  word-break: normal;
                  hyphens: none;
                ">${this.escapeHtml(travel.name)}</h1>
              </div>
              ${metaPieces.length ? `
                <div style="
                  color: rgba(255,255,255,0.95);
                  font-size: 11pt;
                  display: block;
                  font-weight: 500;
                  font-family: ${typography.bodyFont};
                ">
                  ${this.escapeHtml(metaPieces.join(' • '))}
                </div>
              ` : ''}
            </div>
          </div>
        ` : `
          <div style="
            border-radius: ${this.theme.blocks.borderRadius};
            background: linear-gradient(135deg, ${colors.accentSoft} 0%, ${colors.accentLight} 100%);
            height: 235mm;
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${colors.accentStrong};
            box-shadow: ${this.theme.blocks.shadow};
          ">
            <h1 style="
              font-size: ${typography.h1.size};
              font-weight: ${typography.h1.weight};
              text-align: center;
              padding: 20mm;
              font-family: ${typography.headingFont};
            ">${this.escapeHtml(travel.name)}</h1>
          </div>
        `}
        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: ${typography.caption.size};
          color: ${colors.textMuted};
          font-weight: 500;
          font-family: ${typography.bodyFont};
        ">${pageNumber}</div>
      </section>
    `;
  }

  /**
   * Рендерит страницу с контентом путешествия
   */
  private renderTravelContentPage(
    travel: TravelForBook,
    qrCode: string,
    pageNumber: number
  ): string {
    const { colors, typography, spacing } = this.theme;
    const parser = this.getParserSync();
    
    // Парсим контент
    const descriptionBlocks = travel.description
      ? parser.parse(travel.description)
      : [];
    const recommendationBlocks = travel.recommendation
      ? parser.parse(travel.recommendation)
      : [];
    const plusBlocks = travel.plus ? parser.parse(travel.plus) : [];
    const minusBlocks = travel.minus ? parser.parse(travel.minus) : [];

    const url = travel.slug
      ? `https://metravel.by/travels/${travel.slug}`
      : travel.url;

    const inlineGallery =
      this.currentSettings?.includeGallery === false
        ? ''
        : this.buildInlineGallerySection(travel, colors, typography, spacing);

    return `
      <section class="pdf-page travel-content-page" style="padding: ${spacing.pagePadding};">
        <style>
          .travel-content-page p {
            margin-bottom: ${typography.body.marginBottom};
            line-height: ${typography.body.lineHeight};
            text-align: justify;
            orphans: 2;
            widows: 2;
          }
          .travel-content-page h1,
          .travel-content-page h2,
          .travel-content-page h3 {
            page-break-after: avoid;
            orphans: 3;
            widows: 3;
          }
        </style>
        
        ${descriptionBlocks.length > 0 ? `
          <div style="margin-bottom: ${spacing.sectionSpacing};">
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: ${spacing.elementSpacing};
              padding-bottom: 8px;
              border-bottom: 2px solid ${colors.accentSoft};
            ">
              ${this.renderPdfIcon('pen', colors.text, 20)}
              <h2 style="
                font-size: ${typography.h2.size};
                font-weight: ${typography.h2.weight};
                color: ${colors.accent};
                margin: 0;
                font-family: ${typography.headingFont};
              ">Описание</h2>
            </div>
            <div style="
              font-size: ${typography.body.size};
              line-height: ${typography.body.lineHeight};
              color: ${colors.text};
              font-family: ${typography.bodyFont};
            ">${this.renderBlocks(descriptionBlocks)}</div>
          </div>
        ` : `
          <div style="margin-bottom: ${spacing.sectionSpacing};">
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: ${spacing.elementSpacing};
              padding-bottom: 8px;
              border-bottom: 2px solid ${colors.accentSoft};
            ">
              ${this.renderPdfIcon('pen', colors.text, 20)}
              <h2 style="
                font-size: ${typography.h2.size};
                font-weight: ${typography.h2.weight};
                color: ${colors.accent};
                margin: 0;
                font-family: ${typography.headingFont};
              ">Описание</h2>
            </div>
            <p style="
              color: ${colors.textMuted};
              font-style: italic;
              margin: 0;
              font-family: ${typography.bodyFont};
            ">Описание путешествия отсутствует</p>
          </div>
        `}

        ${inlineGallery}

        ${recommendationBlocks.length > 0 ? `
          <div style="margin-bottom: ${spacing.sectionSpacing};">
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: ${spacing.elementSpacing};
              padding-bottom: 8px;
              border-bottom: 2px solid ${colors.accentSoft};
            ">
              ${this.renderPdfIcon('bulb', colors.text, 20)}
              <h2 style="
                font-size: ${typography.h2.size};
                font-weight: ${typography.h2.weight};
                color: ${colors.accent};
                margin: 0;
                font-family: ${typography.headingFont};
              ">Рекомендации</h2>
            </div>
            <div style="
              font-size: ${typography.body.size};
              line-height: ${typography.body.lineHeight};
              color: ${colors.text};
              font-family: ${typography.bodyFont};
            ">${this.renderBlocks(recommendationBlocks)}</div>
          </div>
        ` : ''}

        ${plusBlocks.length > 0 || minusBlocks.length > 0 ? `
          <div style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: ${spacing.elementSpacing};
            margin-top: ${spacing.blockSpacing};
            break-inside: avoid;
            page-break-inside: avoid;
          ">
            ${plusBlocks.length > 0 ? `
              <div style="
                background: ${colors.tipBlock.background};
                border-radius: ${this.theme.blocks.borderRadius};
                padding: ${spacing.elementSpacing} ${spacing.blockSpacing};
                border: ${this.theme.blocks.borderWidth} solid ${colors.tipBlock.border};
                box-shadow: ${this.theme.blocks.shadow};
                break-inside: avoid;
                page-break-inside: avoid;
              ">
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: ${spacing.elementSpacing};
                ">
                  ${this.renderPdfIcon('sparkle', colors.tipBlock.text, 18)}
                  <h3 style="
                    margin: 0;
                    color: ${colors.tipBlock.text};
                    font-size: ${typography.h4.size};
                    font-weight: ${typography.h4.weight};
                    font-family: ${typography.headingFont};
                  ">Плюсы</h3>
                </div>
                <div style="
                  font-size: ${typography.small.size};
                  line-height: ${typography.small.lineHeight};
                  color: ${colors.tipBlock.text};
                  font-family: ${typography.bodyFont};
                ">${this.renderBlocks(plusBlocks)}</div>
              </div>
            ` : ''}
            ${minusBlocks.length > 0 ? `
              <div style="
                background: ${colors.dangerBlock.background};
                border-radius: ${this.theme.blocks.borderRadius};
                padding: ${spacing.elementSpacing} ${spacing.blockSpacing};
                border: ${this.theme.blocks.borderWidth} solid ${colors.dangerBlock.border};
                box-shadow: ${this.theme.blocks.shadow};
                break-inside: avoid;
                page-break-inside: avoid;
              ">
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: ${spacing.elementSpacing};
                ">
                  ${this.renderPdfIcon('warning', colors.dangerBlock.text, 18)}
                  <h3 style="
                    margin: 0;
                    color: ${colors.dangerBlock.text};
                    font-size: ${typography.h4.size};
                    font-weight: ${typography.h4.weight};
                    font-family: ${typography.headingFont};
                  ">Минусы</h3>
                </div>
                <div style="
                  font-size: ${typography.small.size};
                  line-height: ${typography.small.lineHeight};
                  color: ${colors.dangerBlock.text};
                  font-family: ${typography.bodyFont};
                ">${this.renderBlocks(minusBlocks)}</div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${url ? `
          <div style="
            margin-top: ${spacing.sectionSpacing};
            display: flex;
            gap: ${spacing.blockSpacing};
            align-items: flex-start;
            border-top: ${this.theme.blocks.borderWidth} solid ${colors.border};
            padding-top: ${spacing.blockSpacing};
          ">
            ${qrCode ? `
              <img src="${this.escapeHtml(qrCode)}" alt="QR" style="
                width: 50mm;
                height: 50mm;
                border-radius: ${this.theme.blocks.borderRadius};
                border: 3px solid ${colors.surfaceAlt};
                flex-shrink: 0;
                box-shadow: ${this.theme.blocks.shadow};
              " />
            ` : ''}
            <div style="
              font-size: ${typography.small.size};
              color: ${colors.textMuted};
              flex: 1;
              font-family: ${typography.bodyFont};
            ">
              <div style="
                text-transform: uppercase;
                letter-spacing: 0.08em;
                font-weight: 700;
                margin-bottom: ${spacing.elementSpacing};
                color: ${colors.accent};
                font-size: ${typography.body.size};
                font-family: ${typography.headingFont};
              ">Онлайн-версия</div>
              <div style="
                overflow-wrap: anywhere;
                word-break: break-word;
                line-height: ${typography.body.lineHeight};
                color: ${colors.text};
              ">${this.escapeHtml(url)}</div>
            </div>
          </div>
        ` : ''}

        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: ${typography.caption.size};
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
          z-index: 10;
          pointer-events: none;
        ">${pageNumber}</div>
      </section>
    `;
  }

  /**
   * Рендерит страницы галереи
   */
  renderGalleryPage(travel: TravelForBook, pageNumber: number): string {
    return this.renderGalleryPages(travel, pageNumber)[0] || '';
  }

  private renderGalleryPages(travel: TravelForBook, startPageNumber: number): string[] {
    const { colors, typography, spacing } = this.theme;
    const photos = (travel.gallery || [])
      .map((item) => {
        const raw = typeof item === 'string' ? item : item?.url;
        return this.buildSafeImageUrl(raw);
      })
      .filter((url): url is string => !!url && url.trim().length > 0);

    if (!photos.length) return [];

    const { layout, columns: configuredColumns, spacing: gallerySpacing } =
      this.getGalleryOptions();
    const twoPerPageLayout = this.currentSettings?.galleryTwoPerPageLayout || 'vertical';

    const gapMm = this.getGalleryGapMm(gallerySpacing);

    const photosPerPage = this.getGalleryPhotosPerPage(layout, photos.length);
    const chunks: string[][] = [];
    for (let start = 0; start < photos.length; start += photosPerPage) {
      chunks.push(photos.slice(start, start + photosPerPage));
    }

    return chunks.map((pagePhotos, pageIndex) => {
      const defaultColumns = calculateOptimalColumns(pagePhotos.length, layout);
      const isTwoPerPage = photosPerPage === 2 && pagePhotos.length === 2;
      const columns = pagePhotos.length === 1
        ? 1
        : isTwoPerPage && twoPerPageLayout === 'vertical'
          ? 1
          : Math.max(1, Math.min(4, configuredColumns ?? defaultColumns));

      const imageHeight =
        layout === 'slideshow'
          ? '200mm'
          : pagePhotos.length === 1
            ? '210mm'
            : pagePhotos.length === 2
              ? (isTwoPerPage && twoPerPageLayout === 'vertical' ? '120mm' : '175mm')
              : pagePhotos.length <= 4
                ? '130mm'
                : pagePhotos.length <= 6
                  ? '95mm'
                  : '80mm';

      const gridContainerStyle =
        layout === 'masonry'
          ? `column-count: ${columns}; column-gap: ${gapMm}mm;`
          : `display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: ${gapMm}mm; align-items: stretch;`;

      const pageNumber = startPageNumber + pageIndex;
      const _pageStartIndex = pageIndex * photosPerPage;
      const title = pageIndex === 0 ? 'Фотогалерея' : this.escapeHtml(travel.name);
      const subtitle = pageIndex === 0 ? this.escapeHtml(travel.name) : '';
      const quote = pageIndex === 0 ? this.getGalleryQuote(travel) : null;

      return `
      <section class="pdf-page gallery-page" style="padding: ${spacing.pagePadding}; display: flex; flex-direction: column;">
        <div style="text-align: center; margin-bottom: 8mm;">
          <h2 style="
            font-size: ${typography.h2.size};
            margin-bottom: 3mm;
            font-weight: ${typography.h2.weight};
            color: ${colors.text};
            letter-spacing: 0.02em;
            font-family: ${typography.headingFont};
          ">${title}</h2>
          ${subtitle ? `
          <p style="
            color: ${colors.textMuted};
            font-size: ${typography.body.size};
            font-weight: 500;
            font-family: ${typography.bodyFont};
          ">${subtitle}</p>` : ''}
          ${quote ? `
          <p style="
            margin-top: 6mm;
            color: ${colors.text};
            font-size: ${typography.body.size};
            font-weight: 600;
            font-family: ${typography.bodyFont};
            line-height: ${typography.body.lineHeight};
          ">${this.escapeHtml(quote.text)}</p>` : ''}
          ${quote ? `
          <p style="
            margin-top: 2mm;
            color: ${colors.textMuted};
            font-size: ${typography.caption.size};
            letter-spacing: 0.08em;
            text-transform: uppercase;
            font-family: ${typography.bodyFont};
          ">${this.escapeHtml(quote.author || 'MeTravel.by')}</p>` : ''}
        </div>
        <div style="${gridContainerStyle} flex: 1; min-height: 170mm;">
          ${pagePhotos
            .map((photo, index) => {
              const wrapperStyle =
                layout === 'masonry'
                  ? `break-inside: avoid; margin-bottom: ${gapMm}mm;`
                  : '';

              const polaroidStyle =
                layout === 'polaroid'
                  ? `padding: 1.5mm; background: #fff; transform: rotate(${index % 2 === 0 ? '-1.4deg' : '1.3deg'});`
                  : '';

              const collageHero = layout === 'collage' && index === 0;
              const collageSpan = collageHero ? 'grid-column: span 2; grid-row: span 2;' : '';
              const resolvedHeight = collageHero ? '160mm' : imageHeight;
              const isSingle = pagePhotos.length === 1;
              const forceCover = pagePhotos.length <= 2;
              const imgHeightStyle =
                layout === 'polaroid'
                  ? (forceCover ? `height: ${isSingle ? '210mm' : '190mm'};` : `height: auto; max-height: ${isSingle ? '210mm' : '190mm'};`)
                  : (forceCover ? `height: ${isSingle ? '210mm' : resolvedHeight};` : `height: auto; max-height: ${resolvedHeight};`);
              const wrapperMinHeight =
                layout === 'polaroid'
                  ? (isSingle ? 'min-height: 210mm;' : '')
                  : `min-height: ${isSingle ? '210mm' : resolvedHeight};`;

              return `
            <div style="
              ${wrapperStyle}
              ${collageSpan}
              border-radius: ${this.theme.blocks.borderRadius};
              overflow: hidden;
              position: relative;
              box-shadow: ${this.theme.blocks.shadow};
              background: ${layout === 'polaroid' ? '#fff' : 'transparent'};
              ${polaroidStyle}
              ${wrapperMinHeight}
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <img src="${this.escapeHtml(photo)}" alt="Фото ${index + 1}"
                style="
                  width: 100%;
                  ${imgHeightStyle}
                  object-fit: ${forceCover ? 'cover' : 'contain'};
                  display: block;
                  ${this.getImageFilterStyle()}
                "
                crossorigin="anonymous"
                onerror="this.style.display='none'; this.parentElement.style.background='${colors.surfaceAlt}';" />
            </div>
          `;
            })
            .join('')}
        </div>
        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: ${typography.caption.size};
          color: ${colors.textMuted};
          font-weight: 500;
          font-family: ${typography.bodyFont};
        ">${pageNumber}</div>
      </section>
    `;
    });
  }

  /**
   * Рендерит страницу с картой
   */
  private async renderMapPage(
    travel: TravelForBook,
    locations: NormalizedLocation[],
    pageNumber: number
  ): Promise<string> {
    const { colors, typography, spacing } = this.theme;
    if (!locations.length) return '';

    const mapSvg = this.buildRouteSvg(locations);
    const pointsWithCoords = locations.filter(
      (location) => typeof location.lat === 'number' && typeof location.lng === 'number'
    );

    let snapshotDataUrl: string | null = null;
    if (pointsWithCoords.length) {
      try {
        const generateLeafletRouteSnapshot = await this.getLeafletRouteSnapshot();
        snapshotDataUrl = await generateLeafletRouteSnapshot(
          pointsWithCoords.map((location) => ({
            lat: location.lat as number,
            lng: location.lng as number,
            label: location.address,
          })),
          { width: 1400, height: 900 }
        );
      } catch {
        snapshotDataUrl = null;
      }
    }

    const locationQRCodes = await this.generateLocationQRCodes(locations);
    const locationList = this.buildLocationList(locations, locationQRCodes);

    return `
      <section class="pdf-page map-page" style="padding: ${spacing.pagePadding};">
        <div style="margin-bottom: ${spacing.sectionSpacing};">
          <div style="
            background: linear-gradient(135deg, ${colors.surfaceAlt} 0%, ${colors.surface} 100%);
            border-radius: ${this.theme.blocks.borderRadius};
            padding: 10px;
            border: ${this.theme.blocks.borderWidth} solid ${colors.border};
            box-shadow: ${this.theme.blocks.shadow};
          ">
            <div style="
              border-radius: ${this.theme.blocks.borderRadius};
              overflow: hidden;
              height: 135mm;
            ">
              ${snapshotDataUrl ? `
                <img src="${this.escapeHtml(snapshotDataUrl)}" alt="Карта маршрута"
                  style="width: 100%; height: 100%; display: block; object-fit: contain; ${this.getImageFilterStyle()}" />
              ` : `
                ${mapSvg}
              `}
            </div>
          </div>
        </div>
        <div>
          <h2 style="
            font-size: ${typography.h2.size};
            margin-bottom: 4mm;
            font-family: ${typography.headingFont};
          ">Маршрут</h2>
          <p style="
            color: ${colors.textMuted};
            margin-bottom: ${spacing.elementSpacing};
            font-family: ${typography.bodyFont};
          ">${this.escapeHtml(travel.name)}</p>
          <div>${locationList}</div>
        </div>
        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: ${typography.caption.size};
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
        ">${pageNumber}</div>
      </section>
    `;
  }

  /**
   * Рендерит страницу чек-листов
   */
  private renderChecklistPage(settings: BookSettings, pageNumber: number): string | null {
    if (!settings.checklistSections || !settings.checklistSections.length) {
      return null;
    }

    const { colors, typography, spacing } = this.theme;
    const sections = settings.checklistSections
      .map((section) => ({
        key: section,
        label: CHECKLIST_LABELS[section] || 'Секция',
        items: CHECKLIST_LIBRARY[section] || [],
      }))
      .filter((section) => section.items.length > 0);

    if (!sections.length) return null;

    const cards = sections
      .map(
        (section) => `
        <div style="
          border: ${this.theme.blocks.borderWidth} solid ${colors.border};
          border-radius: ${this.theme.blocks.borderRadius};
          padding: ${spacing.blockSpacing};
          background: ${colors.surface};
          box-shadow: ${this.theme.blocks.shadow};
          break-inside: avoid;
          page-break-inside: avoid;
        ">
          <div style="
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
            margin-bottom: ${spacing.elementSpacing};
          ">
            <h3 style="
              margin: 0;
              font-size: ${typography.h4.size};
              font-weight: ${typography.h4.weight};
              color: ${colors.text};
              font-family: ${typography.headingFont};
              max-width: 100%;
              word-break: break-word;
              line-height: 1.2;
            ">${section.label}</h3>
            <span style="
              font-size: ${typography.caption.size};
              color: ${colors.textMuted};
              font-weight: 600;
              font-family: ${typography.bodyFont};
              line-height: 1.2;
            ">${section.items.length} пунктов</span>
          </div>
          <ul style="
            margin: 0;
            padding-left: 18px;
            color: ${colors.textMuted};
            font-size: ${typography.body.size};
            line-height: ${typography.body.lineHeight};
            font-family: ${typography.bodyFont};
            word-break: break-word;
          ">
            ${section.items.map((item) => `<li>${this.escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      `
      )
      .join('');

    return `
      <section class="pdf-page checklist-page" style="padding: ${spacing.pagePadding};">
        <div style="text-align: center; margin-bottom: ${spacing.sectionSpacing};">
          <h2 style="
            font-size: ${typography.h2.size};
            font-weight: ${typography.h2.weight};
            margin-bottom: ${spacing.elementSpacing};
            letter-spacing: -0.01em;
            color: ${colors.text};
            font-family: ${typography.headingFont};
          ">Чек-листы путешествия</h2>
          <p style="
            color: ${colors.textMuted};
            font-size: ${typography.body.size};
            font-family: ${typography.bodyFont};
          ">Подходит для печати и отметок</p>
        </div>
        <div style="
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: ${spacing.elementSpacing};
        ">
          ${cards}
        </div>
        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: ${typography.caption.size};
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
        ">${pageNumber}</div>
      </section>
    `;
  }

  /**
   * Рендерит финальную страницу
   */
  private renderFinalPage(pageNumber: number): string {
    const { colors, typography } = this.theme;
    const finalQuote = this.selectedQuotes?.final;

    return `
      <section class="pdf-page final-page" style="
        padding: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 285mm;
        text-align: center;
        color: ${colors.text};
        background: #ffffff;
      ">
        <h2 style="
          font-size: ${typography.h1.size};
          margin-bottom: 6mm;
          letter-spacing: -0.02em;
          font-family: ${typography.headingFont};
        ">Спасибо за путешествие!</h2>
        <p style="
          max-width: 120mm;
          margin: 0 auto 10mm auto;
          font-size: ${typography.body.size};
          line-height: ${typography.body.lineHeight};
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
        ">
          Пусть эта книга напоминает о самых тёплых эмоциях
          и помогает планировать новые приключения.
        </p>
        ${finalQuote ? `
          <p style="
            max-width: 120mm;
            margin: 0 auto 4mm auto;
            font-size: 10.5pt;
            line-height: 1.6;
            color: ${colors.textMuted};
            font-style: italic;
            font-family: ${typography.bodyFont};
          ">
            «${this.escapeHtml(finalQuote.text)}»
          </p>
          <p style="
            max-width: 120mm;
            margin: 0 auto;
            font-size: 8.5pt;
            line-height: 1.4;
            color: ${colors.textMuted};
            letter-spacing: 0.06em;
            text-transform: uppercase;
            font-family: ${typography.bodyFont};
          ">
            ${this.escapeHtml(finalQuote.author || 'MeTravel.by')}
          </p>
        ` : ''}
        <div style="
          position: absolute;
          bottom: 22mm;
          width: 100%;
          left: 0;
          text-align: center;
          font-size: ${typography.caption.size};
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
        ">
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 2mm;
            font-size: ${typography.caption.size};
          ">
            <span style="font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;">
              MeTravel.by
            </span>
          </div>
          <div>© ${new Date().getFullYear()}</div>
        </div>
        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: ${typography.caption.size};
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
        ">${pageNumber}</div>
      </section>
    `;
  }

  /**
   * Собирает HTML документ
   */
  private buildHtmlDocument(pages: string[], settings: BookSettings): string {
    const { colors, typography } = this.theme;

    const styles = `
      @page {
        size: A4;
        margin: 0;
      }
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        margin: 0;
        font-family: ${typography.bodyFont};
        color: ${colors.text};
        background: ${colors.background};
        line-height: ${typography.body.lineHeight};
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        text-rendering: optimizeLegibility;
        font-feature-settings: "kern" 1;
        font-kerning: normal;
      }
      .pdf-page {
        width: 210mm;
        min-height: 297mm;
        background: ${colors.surface};
        margin: 0 auto 16px;
        box-shadow: none;
        position: relative;
        overflow: hidden;
      }
      /* Разрыв страницы ПЕРЕД каждой следующей .pdf-page (кроме первой) */
      .pdf-page + .pdf-page {
        page-break-before: always;
      }
      img {
        max-width: 100%;
        display: block;
        height: auto;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
      }
      h1, h2, h3, h4 {
        font-family: ${typography.headingFont};
        color: ${colors.text};
        page-break-after: avoid;
        page-break-inside: avoid;
        orphans: 3;
        widows: 3;
        text-rendering: optimizeLegibility;
        font-feature-settings: "kern" 1;
      }
      h1 + p, h2 + p, h3 + p, h4 + p {
        page-break-before: avoid;
      }
      p {
        orphans: 2;
        widows: 2;
        page-break-inside: avoid;
        text-rendering: optimizeLegibility;
      }
      img, figure, blockquote, pre, table {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      .no-break {
        page-break-inside: avoid;
      }
      .break-before {
        page-break-before: always;
      }
      .break-after {
        page-break-after: always;
      }
      @media print {
        html, body {
          background: ${colors.background};
        }
        * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        a {
          color: inherit;
          text-decoration: none;
        }
        .pdf-page {
          page-break-after: always;
          box-shadow: none;
          margin: 0;
          width: 210mm;
          min-height: 297mm;
        }
        img {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        }
      }
    `;

    return `
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${this.escapeHtml((settings.title || '').trim() || 'MeTravel')}</title>
  
  <!-- Google Fonts для улучшенной типографики -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@400;600;700;800&family=Open+Sans:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <style>${styles}</style>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>
    `;
  }

  // Вспомогательные методы

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
      case 'country':
        return sorted.sort((a, b) =>
          (a.countryName || '').localeCompare(b.countryName || '', 'ru')
        );
      case 'alphabetical':
        return sorted.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      default:
        return sorted;
    }
  }

  private getYearRange(travels: TravelForBook[]): string | undefined {
    const years = travels
      .map((t) => Number(t.year))
      .filter((year) => !Number.isNaN(year) && year > 0);
    if (!years.length) return undefined;
    const min = Math.min(...years);
    const max = Math.max(...years);
    return min === max ? String(min) : `${min} - ${max}`;
  }

  private resolveCoverImage(
    travels: TravelForBook[],
    settings: BookSettings
  ): string | undefined {
    if (settings.coverType === 'gradient') return undefined;
    if (settings.coverType === 'first-photo') {
      const first = travels[0];
      return first?.travel_image_url || first?.travel_image_thumb_url;
    }
    if (settings.coverType === 'custom') {
      return settings.coverImage;
    }
    if (settings.coverType === 'auto') {
      return settings.coverImage || this.getBestCoverImage(travels);
    }
    return settings.coverImage || this.getBestCoverImage(travels);
  }

  private getBestCoverImage(travels: TravelForBook[]): string | undefined {
    for (const travel of travels) {
      const photo = travel.travel_image_url || travel.travel_image_thumb_url;
      if (photo) return photo;
    }
    return undefined;
  }

  private async generateQRCodes(travels: TravelForBook[]): Promise<string[]> {
    const QRCode = await this.getQRCode();
    return Promise.all(
      travels.map((travel) => {
        const url = travel.slug
          ? `https://metravel.by/travels/${travel.slug}/`
          : travel.url || '';
        if (!url) return '';
        try {
          return QRCode.toDataURL(url, { margin: 1, scale: 4, width: 200 });
        } catch {
          return '';
        }
      })
    );
  }

  private buildTravelMeta(
    travels: TravelForBook[],
    settings: BookSettings
  ): TravelSectionMeta[] {
    const meta: TravelSectionMeta[] = [];
    let currentPage = settings.includeToc ? 3 : 2;

    travels.forEach((travel) => {
      const locations = this.normalizeLocations(travel);
      const galleryPhotos = (travel.gallery || [])
        .map((item) => {
          const raw = typeof item === 'string' ? item : item?.url;
          return this.buildSafeImageUrl(raw);
        })
        .filter((url): url is string => !!url && url.trim().length > 0);
      const hasGallery = Boolean(settings.includeGallery && galleryPhotos.length);
      const galleryPageCount = hasGallery
        ? Math.max(1, Math.ceil(galleryPhotos.length / this.getGalleryPhotosPerPage(
          (settings.galleryLayout || 'grid') as GalleryLayout,
          galleryPhotos.length,
          settings
        )))
        : 0;
      const hasMap = Boolean(settings.includeMap && locations.length);

      meta.push({
        travel,
        hasGallery,
        hasMap,
        locations,
        startPage: currentPage,
      });

      currentPage += 2; // photo + text
      if (hasGallery) currentPage += galleryPageCount;
      if (hasMap) currentPage += 1;
    });

    return meta;
  }

  private normalizeLocations(travel: TravelForBook): NormalizedLocation[] {
    if (!Array.isArray(travel.travelAddress)) return [];
    return travel.travelAddress
      .filter(Boolean)
      .map((point, index) => {
        const coords = this.parseCoordinates(point.coord);
        return {
          id: String(point.id ?? index),
          address: point.address || `Точка ${index + 1}`,
          categoryName: point.categoryName,
          coord: point.coord,
          thumbnailUrl: point.travelImageThumbUrl,
          lat: coords?.lat,
          lng: coords?.lng,
        };
      })
      .filter((location) => location.address.trim().length > 0);
  }

  private parseCoordinates(
    coord?: string | null
  ): { lat: number; lng: number } | null {
    if (!coord) return null;
    const [latStr, lngStr] = coord.split(',').map((value) => Number(value.trim()));
    if (Number.isNaN(latStr) || Number.isNaN(lngStr)) return null;
    return { lat: latStr, lng: lngStr };
  }

  private buildRouteSvg(locations: NormalizedLocation[]): string {
    const points = locations
      .map((location) => {
        if (typeof location.lat !== 'number' || typeof location.lng !== 'number')
          return null;
        return { lat: location.lat, lng: location.lng };
      })
      .filter(Boolean) as Array<{ lat: number; lng: number }>;

    if (!points.length) {
      return this.buildMapPlaceholder();
    }

    const lats = points.map((point) => point.lat);
    const lngs = points.map((point) => point.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latRange = Math.max(0.0001, maxLat - minLat);
    const lngRange = Math.max(0.0001, maxLng - minLng);

    const paddingX = 6;
    const paddingY = 8;
    const width = 100 - paddingX * 2;
    const height = 60 - paddingY * 2;

    const normalized = points.map((point, index) => {
      const x = paddingX + ((point.lng - minLng) / lngRange) * width;
      const y = paddingY + ((maxLat - point.lat) / latRange) * height;
      return { x, y, index };
    });

    const circles = normalized
      .map(
        (point) => `
      <g>
        <circle
          cx="${point.x.toFixed(2)}"
          cy="${point.y.toFixed(2)}"
          r="2.6"
          fill="${this.theme.colors.surface}"
          stroke="${this.theme.colors.accentStrong}"
          stroke-width="0.7"
        />
        <text
          x="${point.x.toFixed(2)}"
          y="${(point.y + 0.55).toFixed(2)}"
          font-size="3.4"
          text-anchor="middle"
          fill="${this.theme.colors.text}"
          font-weight="700"
        >
          ${point.index + 1}
        </text>
      </g>
    `
      )
      .join('');

    return `
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" role="img" aria-label="Маршрут путешествия">
      <defs>
        <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${this.theme.colors.surfaceAlt}" />
          <stop offset="100%" stop-color="${this.theme.colors.accentLight}" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="60" rx="5" fill="url(#mapGradient)" />
      ${circles}
    </svg>
  `;
  }

  private buildMapPlaceholder(): string {
    return `
    <svg viewBox="0 0 100 60" role="img" aria-label="Маршрут" preserveAspectRatio="none">
      <defs>
        <linearGradient id="mapPlaceholderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${this.theme.colors.surfaceAlt}" />
          <stop offset="100%" stop-color="${this.theme.colors.accentLight}" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="60" rx="4" fill="url(#mapPlaceholderGradient)" />
      <text x="50" y="32" text-anchor="middle" fill="${this.theme.colors.textMuted}" font-size="8">Недостаточно данных</text>
    </svg>
  `;
  }

  private buildLocationList(locations: NormalizedLocation[], qrCodes: string[]): string {
    const { colors, typography } = this.theme;
    return locations
      .map(
        (location, index) => {
          const rawAddress = location.address || '';
          const [titlePart, ...rest] = rawAddress.split(',');
          const title = titlePart.trim();
          const subtitle = rest.join(',').trim();

          const showCoordinates = this.currentSettings?.showCoordinatesOnMapPage !== false;
          const qr = qrCodes[index] || '';
          const mapsUrl = this.buildGoogleMapsUrl(location);

          return `
        <div style="
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 8px 10px;
          border: 1px solid ${colors.border};
          background: ${colors.surface};
          border-radius: ${this.theme.blocks.borderRadius};
          margin-bottom: 6px;
        ">
          ${location.thumbnailUrl ? `
            <div style="
              width: 170px;
              border-radius: 12px;
              overflow: hidden;
              flex-shrink: 0;
              box-shadow: ${this.theme.blocks.shadow};
              background: ${colors.surfaceAlt};
            ">
              <img src="${this.escapeHtml(location.thumbnailUrl)}" alt="Точка ${index + 1}"
                style="width: 100%; height: auto; object-fit: contain; display: block; ${this.getImageFilterStyle()}" />
            </div>
          ` : ''}
          <div style="flex: 1; min-width: 0;">
            <div style="
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 4px;
            ">
              <div style="
                min-width: 20px;
                height: 20px;
                border-radius: 999px;
                background: ${colors.surfaceAlt};
                color: ${colors.text};
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 9pt;
                flex-shrink: 0;
                border: 1px solid ${colors.border};
                font-family: ${typography.headingFont};
              ">${index + 1}</div>
              <div style="
                font-weight: 600;
                color: ${colors.text};
                font-size: 11pt;
                line-height: 1.35;
                font-family: ${typography.bodyFont};
              ">${this.escapeHtml(title || location.address)}</div>
              ${qr ? `
                <a href="${this.escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer" style="margin-left: auto; display: inline-flex;">
                  <img src="${this.escapeHtml(qr)}" alt="QR" style="
                    width: 24mm;
                    height: 24mm;
                    border-radius: 10px;
                    border: 1px solid ${colors.border};
                    background: #fff;
                  "/>
                </a>
              ` : ''}
            </div>
            ${subtitle ? `
              <div style="
                font-size: 9.5pt;
                color: ${colors.textMuted};
                margin-bottom: 1px;
                font-family: ${typography.bodyFont};
              ">${this.escapeHtml(subtitle)}</div>
            ` : ''}
            ${location.categoryName ? `
              <div style="
                font-size: 9.5pt;
                color: ${colors.textMuted};
                margin-bottom: 1px;
                font-family: ${typography.bodyFont};
              ">${this.escapeHtml(location.categoryName)}</div>
            ` : ''}
            ${location.coord && showCoordinates ? `
              <div style="
                font-size: 8.5pt;
                color: ${colors.textMuted};
                opacity: 0.7;
                font-family: ${typography.monoFont};
              ">${this.escapeHtml(location.coord)}</div>
            ` : ''}
          </div>
        </div>
      `;
        }
      )
      .join('');
  }

  private formatDays(days?: number | null): string {
    if (typeof days !== 'number' || Number.isNaN(days)) return '';
    const normalized = Math.max(0, Math.round(days));
    if (normalized === 0) return '';
    if (normalized % 10 === 1 && normalized % 100 !== 11) return `${normalized} день`;
    if ([2, 3, 4].includes(normalized % 10) && ![12, 13, 14].includes(normalized % 100)) {
      return `${normalized} дня`;
    }
    return `${normalized} дней`;
  }

  private getTravelLabel(count: number): string {
    if (count === 1) return 'путешествие';
    if (count < 5) return 'путешествия';
    return 'путешествий';
  }

  private getPhotoLabel(count: number): string {
    if (count === 1) return 'фотография';
    if (count >= 2 && count <= 4) return 'фотографии';
    return 'фотографий';
  }

  private renderPdfIcon(
    name: 'camera' | 'pen' | 'bulb' | 'warning' | 'sparkle',
    color: string,
    sizePt: number
  ): string {
    const size = `${sizePt}pt`;
    const wrapperStyle = `
      width: ${size};
      height: ${size};
      display: inline-block;
      flex-shrink: 0;
    `;

    const svgStart = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${sizePt}" height="${sizePt}" fill="none" stroke="${this.escapeHtml(color)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
    const svgEnd = `</svg>`;

    const paths: Record<typeof name, string> = {
      camera: `<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>`,
      pen: `<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>`,
      bulb: `<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.7.6 1 1.3 1 2v1h6v-1c0-.7.3-1.4 1-2a7 7 0 0 0-4-12z"/>`,
      warning: `<path d="M10.3 3.2 1.7 18a2 2 0 0 0 1.7 3h17.2a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
      sparkle: `<path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8z"/>`,
    };

    return `
      <span style="${wrapperStyle}">${svgStart}${paths[name]}${svgEnd}</span>
    `;
  }

  private buildSafeImageUrl(url?: string | null): string | undefined {
    if (!url) return undefined;
    const trimmed = String(url).trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('data:')) return trimmed;
    if (this.isLocalResource(trimmed)) return trimmed;
    if (/^https?:\/\/images\.weserv\.nl\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('//')) return this.buildSafeImageUrl(`https:${trimmed}`);
    // Разрешаем относительные пути: дополняем текущим origin
    if (trimmed.startsWith('/')) {
      if (typeof window !== 'undefined' && (window as any).location?.origin) {
        return `${(window as any).location.origin}${trimmed}`;
      }
      return `https://metravel.by${trimmed}`;
    }

    if (!/^https?:\/\//i.test(trimmed) && !trimmed.includes('://')) {
      return this.buildSafeImageUrl(`https://metravel.by/${trimmed.replace(/^\/+/, '')}`);
    }

    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      const isLocalhost = host === 'localhost' || host === '127.0.0.1';
      const isPrivateV4 =
        /^192\.168\./.test(host) ||
        /^10\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

      if (isLocalhost || isPrivateV4) {
        parsed.protocol = 'https:';
        parsed.host = 'metravel.by';
        return this.buildSafeImageUrl(parsed.toString());
      }
    } catch {
      // ignore URL parse errors
    }

    try {
      const normalized = trimmed.replace(/^https?:\/\//i, '');
      const delimiter = encodeURIComponent(normalized);
      // Увеличено разрешение до 2400px для высокого качества печати (300 DPI)
      // Добавлены параметры: q=90 (качество JPEG), il (прогрессивная загрузка)
      return `https://images.weserv.nl/?url=${delimiter}&w=2400&q=90&il&fit=inside`;
    } catch {
      return trimmed;
    }
  }

  private isLocalResource(url: string): boolean {
    const lower = url.toLowerCase();
    // Считаем по-настоящему "локальными" только blob:-URL, которые нельзя надёжно проксировать
    return lower.startsWith('blob:');
  }

  private escapeHtml(value: string | null | undefined): string {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Получает CSS-фильтр для изображений в зависимости от темы
   */
  private getImageFilterStyle(): string {
    return this.theme.imageFilter ? `filter: ${this.theme.imageFilter};` : '';
  }

  /**
   * Рендерит блоки контента
   */
  private renderBlocks(blocks: ParsedContentBlock[]): string {
    if (this.blockRenderer) {
      return this.blockRenderer.renderBlocks(blocks);
    }
    // Fallback: простой рендеринг без BlockRenderer
    return blocks
      .map((block) => {
        switch (block.type) {
          case 'heading':
            return `<h${block.level}>${this.escapeHtml(block.text)}</h${block.level}>`;
          case 'paragraph':
            return `<p>${this.escapeHtml(block.text)}</p>`;
          case 'list': {
            const tag = block.ordered ? 'ol' : 'ul';
            const items = block.items.map((item) => `<li>${this.escapeHtml(item)}</li>`).join('');
            return `<${tag}>${items}</${tag}>`;
          }
          case 'quote':
            return `<blockquote>${this.escapeHtml(block.text)}${
              block.author ? `<cite>— ${this.escapeHtml(block.author)}</cite>` : ''
            }</blockquote>`;
          case 'image':
            return `<img src="${this.escapeHtml(block.src)}" alt="${this.escapeHtml(
              block.alt || ''
            )}" style="${this.getImageFilterStyle()}" />${block.caption ? `<figcaption>${this.escapeHtml(block.caption)}</figcaption>` : ''}`;
          default:
            return '';
        }
      })
      .join('\n');
  }

  private getParserSync(): ContentParser {
    if (!this.parser) {
      throw new Error('ContentParser is not initialized');
    }
    return this.parser;
  }

  private async ensureParser(): Promise<ContentParser> {
    if (this.parser) return this.parser;
    const mod = await import('../parsers/ContentParser');
    this.parser = new mod.ContentParser();
    return this.parser;
  }

  private async ensureBlockRenderer(): Promise<BlockRenderer | null> {
    if (typeof document === 'undefined') return null;
    if (this.blockRenderer) return this.blockRenderer;
    const mod = await import('../renderers/BlockRenderer');
    this.blockRenderer = new mod.BlockRenderer(this.theme);
    return this.blockRenderer;
  }

  private async getQRCode(): Promise<{ toDataURL: (text: string, options: Record<string, unknown>) => Promise<string> }> {
    const mod = await import('qrcode');
    const QRCode = (mod as any).default ?? mod;
    return QRCode as any;
  }

  private async getLeafletRouteSnapshot(): Promise<typeof import('@/src/utils/mapImageGenerator').generateLeafletRouteSnapshot> {
    const mod = await import('@/src/utils/mapImageGenerator');
    return mod.generateLeafletRouteSnapshot;
  }
}

interface TravelSectionMeta {
  travel: TravelForBook;
  hasGallery: boolean;
  hasMap: boolean;
  locations: NormalizedLocation[];
  startPage: number;
}

interface NormalizedLocation {
  id: string;
  address: string;
  categoryName?: string;
  coord?: string;
  thumbnailUrl?: string;
  lat?: number;
  lng?: number;
}
