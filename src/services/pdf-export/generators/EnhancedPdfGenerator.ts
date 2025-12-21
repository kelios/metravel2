// src/services/pdf-export/generators/EnhancedPdfGenerator.ts
// ✅ АРХИТЕКТУРА: Улучшенный генератор PDF с новой системой тем и парсером

import QRCode from 'qrcode';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/src/types/pdf-export';
import { generateLeafletRouteSnapshot } from '@/src/utils/mapImageGenerator';
import { getThemeConfig, type PdfThemeName } from '../themes/PdfThemeConfig';
import { ContentParser } from '../parsers/ContentParser';
import { BlockRenderer } from '../renderers/BlockRenderer';
import type { TravelQuote } from '../quotes/travelQuotes';
import { pickRandomQuote } from '../quotes/travelQuotes';

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
  private parser: ContentParser;
  private blockRenderer: BlockRenderer | null = null;
  private theme: ReturnType<typeof getThemeConfig>;
  private selectedQuotes?: { cover?: TravelQuote; final?: TravelQuote };
  private currentSettings?: BookSettings;

  constructor(themeName: PdfThemeName | string) {
    this.theme = getThemeConfig(themeName);
    this.parser = new ContentParser();
    // Инициализируем blockRenderer только если доступен DOM
    if (typeof document !== 'undefined') {
      this.blockRenderer = new BlockRenderer(this.theme);
    }
  }

  /**
   * Генерирует HTML для PDF книги
   */
  async generate(
    travels: TravelForBook[],
    settings: BookSettings
  ): Promise<string> {
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

    // Обложка
    pages.push(this.renderCoverPage(settings, userName, sortedTravels.length, yearRange, coverImage));

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
    const travelLabel = this.getTravelLabel(travelCount);
    const safeCoverImage = this.buildSafeImageUrl(coverImage);
    const coverQuote = this.selectedQuotes?.cover;
    
    const background = safeCoverImage
      ? `linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.75) 100%), url('${this.escapeHtml(safeCoverImage)}')`
      : `linear-gradient(135deg, ${colors.cover.backgroundGradient[0]} 0%, ${colors.cover.backgroundGradient[1]} 100%)`;

    return `
      <section class="pdf-page cover-page" style="
        padding: 0;
        height: 285mm;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        color: ${colors.cover.text};
        background: ${background};
        background-size: cover;
        background-position: center;
        position: relative;
        overflow: hidden;
      ">
        <div style="padding: 40mm 30mm; position: relative; z-index: 2;">
          ${settings.subtitle ? `
            <div style="
              font-size: 14pt;
              letter-spacing: 0.2em;
              text-transform: uppercase;
              color: rgba(255,255,255,0.8);
              margin-bottom: 12mm;
              font-family: ${typography.bodyFont};
            ">${this.escapeHtml(settings.subtitle)}</div>
          ` : ''}
          <h1 style="
            font-size: ${typography.h1.size};
            font-weight: ${typography.h1.weight};
            line-height: ${typography.h1.lineHeight};
            margin-bottom: 20mm;
            text-shadow: 0 10px 30px rgba(0,0,0,0.45);
            font-family: ${typography.headingFont};
          ">${this.escapeHtml(settings.title)}</h1>
          <div style="display: flex; gap: 24mm; align-items: center; margin-bottom: 16mm;">
            <div>
              <div style="font-size: 32pt; font-weight: 800; color: ${colors.accent};">
                ${travelCount}
              </div>
              <div style="font-size: 13pt; text-transform: uppercase; letter-spacing: 0.08em;">
                ${travelLabel}
              </div>
            </div>
            ${yearRange ? `
              <div style="border-left: 1px solid rgba(255,255,255,0.4); padding-left: 24mm;">
                <div style="font-size: 32pt; font-weight: 700; color: ${colors.accent};">
                  ${yearRange}
                </div>
                <div style="font-size: 13pt; letter-spacing: 0.08em;">годы</div>
              </div>
            ` : ''}
          </div>
          <div style="font-size: 16pt; font-style: italic; opacity: 0.95; margin-bottom: 28mm; font-family: ${typography.bodyFont};">
            ${this.escapeHtml(userName)}
          </div>
          <div style="font-size: 11pt; opacity: 0.75; font-family: ${typography.bodyFont};">
            Создано ${new Date().toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
          ${coverQuote ? `
            <div style="
              margin-top: 10mm;
              max-width: 110mm;
              font-size: 11pt;
              line-height: 1.6;
              color: rgba(255,255,255,0.9);
              font-style: italic;
              font-family: ${typography.bodyFont};
            ">
              «${this.escapeHtml(coverQuote.text)}»
              ${coverQuote.author ? `
                <div style="
                  margin-top: 3mm;
                  font-size: 9pt;
                  letter-spacing: 0.08em;
                  text-transform: uppercase;
                  opacity: 0.9;
                ">
                  ${this.escapeHtml(coverQuote.author)}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
        <div style="position: absolute; bottom: 20mm; right: 25mm; font-weight: 600; letter-spacing: 0.12em; font-family: ${typography.bodyFont};">
          MeTravel
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
            <span style="font-size: 20pt; line-height: 1;">📸</span>
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
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 4mm;
            position: relative;
          ">
            ${previewPhotos.map((photo, index) => `
              <div style="
                border-radius: ${this.theme.blocks.borderRadius};
                overflow: hidden;
                background: ${colors.surfaceAlt};
                box-shadow: ${this.theme.blocks.shadow};
                position: relative;
                ${index === 3 ? `
                  &::after {
                    content: '+${remaining}';
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.7);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24pt;
                    font-weight: 700;
                  }
                ` : ''}
              ">
                <img src="${this.escapeHtml(photo)}" alt="Фото ${index + 1}"
                  style="width: 100%; height: 45mm; object-fit: cover; display: block;"
                  crossorigin="anonymous"
                  onerror="this.style.display='none'; this.parentElement.style.background='${colors.surfaceAlt}';" />
                ${index === 3 && remaining > 0 ? `
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
          <p style="
            margin-top: ${spacing.elementSpacing};
            font-size: ${typography.small.size};
            color: ${colors.textMuted};
            text-align: center;
            font-style: italic;
            font-family: ${typography.bodyFont};
          ">Полная галерея на следующей странице</p>
        </div>
      `;
    }

    // Для 1-4 фото: компактная встроенная галерея
    if (photos.length === 1) {
      return `
        <div style="margin-bottom: ${spacing.sectionSpacing};">
          <div style="
            border-radius: ${this.theme.blocks.borderRadius};
            overflow: hidden;
            box-shadow: ${this.theme.blocks.shadow};
            background: ${colors.surfaceAlt};
          ">
            <img src="${this.escapeHtml(photos[0])}" alt="Фото путешествия"
              style="width: 100%; height: 85mm; object-fit: cover; display: block;"
              crossorigin="anonymous"
              onerror="this.style.display='none'; this.parentElement.style.background='${colors.surfaceAlt}';" />
          </div>
        </div>
      `;
    }

    // Для 2-4 фото: сетка
    const gridColumns = photos.length === 2 ? 2 : photos.length === 3 ? 3 : 2;
    const imageHeight = photos.length === 2 ? '65mm' : photos.length === 3 ? '55mm' : '50mm';

    return `
      <div style="margin-bottom: ${spacing.sectionSpacing};">
        <div style="
          display: grid;
          grid-template-columns: repeat(${gridColumns}, 1fr);
          gap: 5mm;
        ">
          ${photos.map((photo, index) => `
            <div style="
              border-radius: ${this.theme.blocks.borderRadius};
              overflow: hidden;
              background: ${colors.surfaceAlt};
              box-shadow: ${this.theme.blocks.shadow};
            ">
              <img src="${this.escapeHtml(photo)}" alt="Фото ${index + 1}"
                style="width: 100%; height: ${imageHeight}; object-fit: cover; display: block;"
                crossorigin="anonymous"
                onerror="this.style.display='none'; this.parentElement.style.background='${colors.surfaceAlt}';" />
            </div>
          `).join('')}
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
                object-fit: cover;
                display: block;
              "
              crossorigin="anonymous"
              onerror="this.style.display='none'; this.parentElement.style.background='${colors.accentSoft}';" />
            <div style="
              position: absolute;
              left: 0;
              right: 0;
              bottom: 0;
              background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.85) 100%);
              padding: 22mm 22mm 18mm 22mm;
            ">
              <h1 style="
                color: #ffffff;
                font-size: ${typography.h1.size};
                margin-bottom: 8mm;
                font-weight: ${typography.h1.weight};
                line-height: ${typography.h1.lineHeight};
                text-shadow: 0 4px 12px rgba(0,0,0,0.5);
                font-family: ${typography.headingFont};
              ">${this.escapeHtml(travel.name)}</h1>
              ${metaPieces.length ? `
                <div style="
                  color: rgba(255,255,255,0.95);
                  font-size: ${typography.body.size};
                  display: flex;
                  gap: 16px;
                  flex-wrap: wrap;
                  font-weight: 500;
                  font-family: ${typography.bodyFont};
                ">
                  ${travel.countryName ? `
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                      <span style="
                        width: 14px;
                        height: 14px;
                        border-radius: 999px;
                        border: 1px solid rgba(255,255,255,0.8);
                        opacity: 0.9;
                        display: inline-block;
                      "></span>
                      <span>${this.escapeHtml(travel.countryName)}</span>
                    </span>
                  ` : ''}
                  ${travel.year ? `
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                      <span style="
                        width: 14px;
                        height: 14px;
                        border-radius: 4px;
                        border: 1px solid rgba(255,255,255,0.8);
                        opacity: 0.9;
                        display: inline-block;
                      "></span>
                      <span>${this.escapeHtml(String(travel.year))}</span>
                    </span>
                  ` : ''}
                  ${this.formatDays(travel.number_days) ? `
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                      <span style="
                        width: 14px;
                        height: 2px;
                        border-radius: 999px;
                        background-color: rgba(255,255,255,0.8);
                        display: inline-block;
                      "></span>
                      <span>${this.formatDays(travel.number_days)}</span>
                    </span>
                  ` : ''}
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
    
    // Парсим контент
    const descriptionBlocks = travel.description
      ? this.parser.parse(travel.description)
      : [];
    const recommendationBlocks = travel.recommendation
      ? this.parser.parse(travel.recommendation)
      : [];
    const plusBlocks = travel.plus ? this.parser.parse(travel.plus) : [];
    const minusBlocks = travel.minus ? this.parser.parse(travel.minus) : [];

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
              <span style="
                font-size: 20pt;
                line-height: 1;
              ">📝</span>
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
              <span style="
                font-size: 20pt;
                line-height: 1;
              ">📝</span>
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
              <span style="
                font-size: 20pt;
                line-height: 1;
              ">💡</span>
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
          ">
            ${plusBlocks.length > 0 ? `
              <div style="
                background: ${colors.tipBlock.background};
                border-radius: ${this.theme.blocks.borderRadius};
                padding: ${spacing.elementSpacing} ${spacing.blockSpacing};
                border: ${this.theme.blocks.borderWidth} solid ${colors.tipBlock.border};
                box-shadow: ${this.theme.blocks.shadow};
              ">
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: ${spacing.elementSpacing};
                ">
                  <span style="font-size: 18pt; line-height: 1;">✨</span>
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
              ">
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: ${spacing.elementSpacing};
                ">
                  <span style="font-size: 18pt; line-height: 1;">⚠️</span>
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
              <img src="${qrCode}" alt="QR" style="
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
                word-break: break-all;
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
   * Рендерит страницу галереи
   */
  private renderGalleryPage(travel: TravelForBook, pageNumber: number): string {
    const { colors, typography, spacing } = this.theme;
    const photos = (travel.gallery || [])
      .map((item) => {
        const raw = typeof item === 'string' ? item : item?.url;
        return this.buildSafeImageUrl(raw);
      })
      .filter((url): url is string => !!url && url.trim().length > 0);

    if (!photos.length) return '';

    const columns = photos.length <= 4 ? 2 : photos.length <= 6 ? 3 : 4;
    const imageHeight = photos.length <= 4 ? '80mm' : photos.length <= 6 ? '65mm' : '55mm';

    return `
      <section class="pdf-page gallery-page" style="padding: ${spacing.pagePadding};">
        <div style="text-align: center; margin-bottom: 18mm;">
          <h2 style="
            font-size: ${typography.h2.size};
            margin-bottom: 6mm;
            font-weight: ${typography.h2.weight};
            color: ${colors.text};
            letter-spacing: 0.02em;
            font-family: ${typography.headingFont};
          ">Фотогалерея</h2>
          <p style="
            color: ${colors.textMuted};
            font-size: ${typography.body.size};
            font-weight: 500;
            font-family: ${typography.bodyFont};
          ">${this.escapeHtml(travel.name)}</p>
        </div>
        <div style="
          display: grid;
          grid-template-columns: repeat(${columns}, 1fr);
          gap: 6mm;
        ">
          ${photos
            .map(
              (photo, index) => `
            <div style="
              border-radius: ${this.theme.blocks.borderRadius};
              overflow: hidden;
              position: relative;
              box-shadow: ${this.theme.blocks.shadow};
              background: ${colors.surfaceAlt};
            ">
              <img src="${this.escapeHtml(photo)}" alt="Фото ${index + 1}"
                style="
                  width: 100%;
                  height: ${imageHeight};
                  object-fit: cover;
                  display: block;
                "
                crossorigin="anonymous"
                onerror="this.style.display='none'; this.parentElement.style.background='${colors.surfaceAlt}';" />
              <div style="
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(0,0,0,0.7);
                color: #fff;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11pt;
                font-weight: 700;
                box-shadow: ${this.theme.blocks.shadow};
              ">${index + 1}</div>
            </div>
          `
            )
            .join('')}
        </div>
        <div style="
          margin-top: 14mm;
          text-align: center;
          color: ${colors.textMuted};
          font-size: ${typography.body.size};
          font-weight: 500;
          font-family: ${typography.bodyFont};
        ">${photos.length} ${this.getPhotoLabel(photos.length)}</div>
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
        snapshotDataUrl = await generateLeafletRouteSnapshot(
          pointsWithCoords.map((location) => ({
            lat: location.lat as number,
            lng: location.lng as number,
          })),
          { width: 800, height: 480, zoom: 11 }
        );
      } catch {
        snapshotDataUrl = null;
      }
    }

    const locationList = this.buildLocationList(locations);

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
              height: 115mm;
            ">
              ${snapshotDataUrl ? `
                <img src="${this.escapeHtml(snapshotDataUrl)}" alt="Карта маршрута"
                  style="width: 100%; height: 100%; display: block; object-fit: cover;" />
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
        ">
          <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: ${spacing.elementSpacing};
          ">
            <h3 style="
              margin: 0;
              font-size: ${typography.h4.size};
              font-weight: ${typography.h4.weight};
              color: ${colors.text};
              font-family: ${typography.headingFont};
            ">${section.label}</h3>
            <span style="
              font-size: ${typography.caption.size};
              color: ${colors.textMuted};
              font-weight: 600;
              font-family: ${typography.bodyFont};
            ">${section.items.length} пунктов</span>
          </div>
          <ul style="
            margin: 0;
            padding-left: 18px;
            color: ${colors.textMuted};
            font-size: ${typography.body.size};
            line-height: ${typography.body.lineHeight};
            font-family: ${typography.bodyFont};
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
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
          ${finalQuote.author ? `
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
              ${this.escapeHtml(finalQuote.author)}
            </p>
          ` : ''}
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
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        margin: 0;
        font-family: ${typography.bodyFont};
        color: ${colors.text};
        background: ${colors.background};
        line-height: ${typography.body.lineHeight};
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      .pdf-page {
        width: 210mm;
        min-height: 297mm;
        background: ${colors.surface};
        margin: 0 auto 16px;
        box-shadow: ${this.theme.blocks.shadow};
        position: relative;
        overflow: visible;
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
      }
      h1 + p, h2 + p, h3 + p, h4 + p {
        page-break-before: avoid;
      }
      p {
        orphans: 2;
        widows: 2;
        page-break-inside: avoid;
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
        body { background: ${colors.background}; }
        .pdf-page {
          page-break-after: always;
          box-shadow: none;
          margin: 0 auto;
          width: 210mm;
          min-height: 297mm;
        }
      }
    `;

    return `
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${this.escapeHtml(settings.title)}</title>
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
      const hasGallery = Boolean(
        settings.includeGallery && travel.gallery && travel.gallery.length
      );
      const hasMap = Boolean(settings.includeMap && locations.length);

      meta.push({
        travel,
        hasGallery,
        hasMap,
        locations,
        startPage: currentPage,
      });

      currentPage += 2; // photo + text
      if (hasGallery) currentPage += 1;
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

    const path = normalized
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)},${point.y.toFixed(2)}`
      )
      .join(' ');

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
      <path d="${path}" fill="none" stroke="${this.theme.colors.accentStrong}" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round" />
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

  private buildLocationList(locations: NormalizedLocation[]): string {
    const { colors, typography } = this.theme;
    return locations
      .map(
        (location, index) => {
          const rawAddress = location.address || '';
          const [titlePart, ...rest] = rawAddress.split(',');
          const title = titlePart.trim();
          const subtitle = rest.join(',').trim();

          const showCoordinates = this.currentSettings?.showCoordinatesOnMapPage !== false;

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
                style="width: 100%; height: auto; object-fit: cover; display: block;" />
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
    if (count < 5) return 'фотографии';
    return 'фотографий';
  }

  private buildSafeImageUrl(url?: string | null): string | undefined {
    if (!url) return undefined;
    const trimmed = String(url).trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('data:')) return trimmed;
    // Разрешаем относительные пути: дополняем текущим origin
    if (trimmed.startsWith('/')) {
      if (typeof window !== 'undefined' && (window as any).location?.origin) {
        return `${(window as any).location.origin}${trimmed}`;
      }
      return trimmed;
    }

    try {
      const normalized = trimmed.replace(/^https?:\/\//i, '');
      const delimiter = encodeURIComponent(normalized);
      return `https://images.weserv.nl/?url=${delimiter}&w=1600&fit=inside`;
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
   * Рендерит блоки контента
   */
  private renderBlocks(blocks: ReturnType<typeof this.parser.parse>): string {
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
            )}" />${block.caption ? `<figcaption>${this.escapeHtml(block.caption)}</figcaption>` : ''}`;
          default:
            return '';
        }
      })
      .join('\n');
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
