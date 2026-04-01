// src/services/pdf-export/generators/v2/runtime/EnhancedPdfGeneratorBase.ts
// ✅ RUNTIME: Общая orchestration/runtime-логика для канонического EnhancedPdfGenerator v2

import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/types/pdf-export';
import type { GalleryLayout, CaptionPosition } from '@/types/pdf-gallery';
import { getThemeConfig, type PdfThemeName } from '../../../themes/PdfThemeConfig';
import type { ContentParser, ParsedContentBlock } from '../../../parsers/ContentParser';
import type { BlockRenderer } from '../../../renderers/BlockRenderer';
import type { TravelQuote } from '../../../quotes/travelQuotes';
import { pickRandomQuote } from '../../../quotes/travelQuotes';
import { CoverPageGenerator } from '../pages/CoverPageGenerator';
import { buildSafeImageUrl, escapeHtml as sharedEscapeHtml } from '../../../utils/htmlUtils';
import { formatDays as sharedFormatDays, getTravelLabel as sharedGetTravelLabel, getPhotoLabel as sharedGetPhotoLabel } from '../../../utils/pluralize';
import {
  buildGoogleMapsUrl as sharedBuildGoogleMapsUrl,
  buildMapPlaceholder as sharedBuildMapPlaceholder,
  buildRouteSvg as sharedBuildRouteSvg,
  buildTravelMeta as sharedBuildTravelMeta,
  calculateRouteDistanceFromPreview as sharedCalculateRouteDistanceFromPreview,
  getYearRange as sharedGetYearRange,
  normalizeLocations as sharedNormalizeLocations,
  sortTravels as sharedSortTravels,
} from './bookData';
import type { NormalizedLocation, TravelSectionMeta } from './types';

import { assembleBookPages } from './pdfPageAssembly';
import { renderChecklistPageSection, renderTocPageSection } from './pdfSectionRenderers';
import {
  buildContainImageMarkup,
  buildGalleryCaption as sharedBuildGalleryCaption,
  getGalleryGapMm as sharedGetGalleryGapMm,
  getImageFilterStyle,
  renderPdfIcon as sharedRenderPdfIcon,
} from './pdfVisualHelpers';
import { renderTravelPhotoPageMarkup } from './travelPhotoPage';
import { renderTravelContentPageMarkup } from './travelContentPage';
import { buildPdfMapRuntimeData } from './pdfRuntimeMapData';
import {
  buildPdfHtmlDocument,
  buildPdfInlineGallerySection,
  buildPdfLocationCards,
  buildPdfRunningHeader,
  buildPdfSeparatorPage,
  buildPdfStatsMiniCard,
  buildPdfTravelContentRuntimeData,
} from './pdfRuntimeMarkup';
import { RuntimeFinalRenderer } from './renderers/FinalPageRenderer';
import { RuntimeGalleryRenderer } from './renderers/GalleryPageRenderer';
import { RuntimeMapRenderer } from './renderers/MapPageRenderer';

/**
 * Базовый runtime для полной генерации PDF-книги.
 * Канонический public entrypoint живет в ../EnhancedPdfGenerator.ts.
 */
export class EnhancedPdfGeneratorBase {
  private parser: ContentParser | null = null;
  private blockRenderer: BlockRenderer | null = null;
  private theme: ReturnType<typeof getThemeConfig>;
  private themeName: string;
  private selectedQuotes?: { cover?: TravelQuote; final?: TravelQuote };
  private currentSettings?: BookSettings;
  private finalRenderer!: RuntimeFinalRenderer;
  private galleryRenderer!: RuntimeGalleryRenderer;
  private mapRenderer!: RuntimeMapRenderer;

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
    return sharedGetGalleryGapMm(spacing);
  }

  private buildGalleryCaption(
    index: number,
    position: CaptionPosition,
    typography: ReturnType<typeof getThemeConfig>['typography']
  ): { wrapperStart: string; wrapperEnd: string } {
    return sharedBuildGalleryCaption({
      index,
      position,
      typography,
      colors: this.theme.colors,
    });
  }

  constructor(themeName: PdfThemeName | string) {
    this.theme = getThemeConfig(themeName);
    this.themeName = themeName;
    this.initRenderers();
  }

  private initRenderers(): void {
    const ctx = { theme: this.theme, settings: this.currentSettings };
    this.finalRenderer = new RuntimeFinalRenderer(ctx);
    this.galleryRenderer = new RuntimeGalleryRenderer(ctx);
    this.mapRenderer = new RuntimeMapRenderer(ctx);
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
    this.initRenderers(); // reinit with updated settings

    const sortedTravels = this.sortTravels(travels, settings.sortOrder);
    if (!this.selectedQuotes) {
      const coverQuote = pickRandomQuote();
      const finalQuote = pickRandomQuote(coverQuote);
      this.selectedQuotes = { cover: coverQuote, final: finalQuote };
    }

    // Генерируем QR коды
    const qrCodes = await this.generateQRCodes(sortedTravels);

    // Собираем метаданные для оглавления
    const meta = this.buildTravelMeta(sortedTravels, settings);
    
    // Обложка с улучшенным дизайном
    const coverQuote = this.selectedQuotes?.cover;
    const coverGenerator = new CoverPageGenerator(undefined, coverQuote);
    const coverPage = await coverGenerator.generate({
      travels: sortedTravels,
      settings,
      theme: this.theme,
      pageNumber: 1,
    });
    const pages = await assembleBookPages({
      coverPage,
      meta,
      qrCodes,
      settings,
      sortedTravels,
      renderTocPage: (tocMeta, pageNumber, totalCount, startIndex) =>
        this.renderTocPage(tocMeta, pageNumber, totalCount, startIndex),
      renderSeparatorPage: (travel, travelIndex, totalTravels) =>
        this.renderSeparatorPage(travel, travelIndex, totalTravels),
      renderTravelPhotoPage: (travel, pageNumber) => this.renderTravelPhotoPage(travel, pageNumber),
      renderTravelContentPage: (travel, qrCodeDataUrl, pageNumber) =>
        this.renderTravelContentPage(travel, qrCodeDataUrl, pageNumber),
      renderGalleryPages: (travel, startPageNumber) => this.renderGalleryPages(travel, startPageNumber),
      renderMapPage: (travel, locations, pageNumber) => this.renderMapPage(travel, locations, pageNumber),
      renderChecklistPage: (currentSettings, pageNumber) =>
        this.renderChecklistPage(currentSettings, pageNumber),
      renderFinalPage: (pageNumber, finalTravels) => this.renderFinalPage(pageNumber, finalTravels),
    });

    // Собираем HTML
    return this.buildHtmlDocument(pages, settings);
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
    const { layout, columns: configuredColumns, showCaptions, captionPosition, spacing: gallerySpacing } =
      this.getGalleryOptions();
    return buildPdfInlineGallerySection({
      travel,
      theme: this.theme,
      colors,
      typography,
      spacing,
      layout,
      columns: configuredColumns,
      showCaptions,
      captionPosition,
      galleryGapMm: this.getGalleryGapMm(gallerySpacing),
      buildSafeImageUrl: (url) => this.buildSafeImageUrl(url),
      buildContainImage: (src, alt, height, opts) => this.buildContainImage(src, alt, height, opts),
      buildGalleryCaption: (index, position, currentTypography) =>
        this.buildGalleryCaption(index, position, currentTypography),
      renderPdfIcon: (name, color, sizePt) => this.renderPdfIcon(name, color, sizePt),
      getPhotoLabel: (count) => this.getPhotoLabel(count),
    });
  }

  /**
   * Рендерит оглавление
   */
  private renderTocPage(
    meta: TravelSectionMeta[],
    pageNumber: number,
    totalCount: number,
    startIndex: number,
  ): string {
    return renderTocPageSection({
      meta,
      pageNumber,
      totalCount,
      startIndex,
      theme: this.theme,
      escapeHtml: (value) => this.escapeHtml(value),
      buildSafeImageUrl: (raw) => this.buildSafeImageUrl(raw),
      formatDays: (days) => {
        if (typeof days === 'number') {
          return this.formatDays(days);
        }
        if (typeof days === 'string') {
          const parsed = Number(days);
          return this.formatDays(Number.isFinite(parsed) ? parsed : undefined);
        }
        return this.formatDays(days);
      },
      getTravelLabel: (count) => this.getTravelLabel(count),
      getImageFilterStyle: () => this.getImageFilterStyle(),
    });
  }

  /**
   * Рендерит страницу с фото путешествия (поддерживает 3 layout'а)
   */
  private renderTravelPhotoPage(travel: TravelForBook, pageNumber: number): string {
    return renderTravelPhotoPageMarkup({
      travel,
      pageNumber,
      theme: this.theme,
      layout: this.currentSettings?.photoPageLayout || 'full-bleed',
      buildSafeImageUrl: (url) => this.buildSafeImageUrl(url),
      escapeHtml: (value) => this.escapeHtml(value),
      formatDays: (days) => this.formatDays(days),
      buildContainImage: (src, alt, height, opts) => this.buildContainImage(src, alt, height, opts),
      getImageFilterStyle: () => this.getImageFilterStyle(),
    });
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
    const contentRuntimeData = buildPdfTravelContentRuntimeData({
      travel,
      includeGallery: this.currentSettings?.includeGallery,
      descriptionHtml:
        this.blockRenderer && travel.description
          ? this.blockRenderer.renderRichText(travel.description)
          : '',
      parseBlocks: (content) => parser.parse(content),
      buildInlineGallerySection: () => this.buildInlineGallerySection(travel, colors, typography, spacing),
      buildSafeImageUrl: (url) => this.buildSafeImageUrl(url),
    });

    return renderTravelContentPageMarkup({
      travel,
      pageNumber,
      theme: this.theme,
      qrCode,
      variant: 'runtime',
      descriptionHtml: contentRuntimeData.descriptionHtml,
      recommendationBlocks: contentRuntimeData.recommendationBlocks,
      plusBlocks: contentRuntimeData.plusBlocks,
      minusBlocks: contentRuntimeData.minusBlocks,
      renderBlocks: (blocks) => this.renderBlocks(blocks),
      renderPdfIcon: (name, color, size) => this.renderPdfIcon(name as any, color, size),
      escapeHtml: (value) => this.escapeHtml(value),
      headerHtml: this.buildRunningHeader(travel.name, pageNumber),
      statsHtml: this.buildStatsMiniCard(travel, colors, typography, spacing),
      inlineGalleryHtml: contentRuntimeData.inlineGalleryHtml,
      showInlineGallery: true,
      includeGallery: this.currentSettings?.includeGallery,
      hasGalleryMedia: contentRuntimeData.hasGalleryMedia,
    });
  }

  /**
   * Рендерит страницы галереи
   */
  renderGalleryPage(travel: TravelForBook, pageNumber: number): string {
    return this.renderGalleryPages(travel, pageNumber)[0] || '';
  }

  private renderGalleryPages(travel: TravelForBook, startPageNumber: number): string[] {
    return this.galleryRenderer.renderPages(travel, startPageNumber);
  }

  /**
   * Рендерит страницу с картой
   */
  private async renderMapPage(
    travel: TravelForBook,
    locations: NormalizedLocation[],
    pageNumber: number
  ): Promise<string> {
    if (!locations.length) return '';
    const mapRuntimeData = await buildPdfMapRuntimeData({
      travel,
      locations,
      buildRouteSvg: (mapLocations, options) => this.buildRouteSvg(mapLocations, options),
      calculateRouteDistanceFromPreview: (preview) => this.calculateRouteDistanceFromPreview(preview),
      generateLocationQRCodes: (mapLocations) => this.generateLocationQRCodes(mapLocations),
      buildLocationCards: (mapLocations, qrCodes) => this.buildLocationCards(mapLocations, qrCodes),
      getLeafletRouteSnapshot: () => this.getLeafletRouteSnapshot(),
    });

    return this.mapRenderer.render({
      travelName: travel.name,
      snapshotDataUrl: mapRuntimeData.snapshotDataUrl,
      mapSvg: mapRuntimeData.mapSvg,
      locationCards: mapRuntimeData.locationCards,
      locationCount: locations.length,
      pageNumber,
      routeInfo: mapRuntimeData.routeInfo,
      routePreview: mapRuntimeData.routePreview,
    });
  }

  private calculateRouteDistanceFromPreview(preview: import('@/types/travelRoutes').ParsedRoutePreview): number {
    return sharedCalculateRouteDistanceFromPreview(preview);
  }

  /**
   * Рендерит страницу чек-листов
   */
  private renderChecklistPage(settings: BookSettings, pageNumber: number): string | null {
    return renderChecklistPageSection({
      settings,
      pageNumber,
      theme: this.theme,
      escapeHtml: (value) => this.escapeHtml(value),
      buildRunningHeader: (title, currentPage) => this.buildRunningHeader(title, currentPage),
    });
  }

  /**
   * Рендерит финальную страницу
   */
  private renderFinalPage(pageNumber: number, travels: TravelForBook[] = []): string {
    return this.finalRenderer.render(pageNumber, travels, this.selectedQuotes?.final);
  }

  /**
   * Собирает HTML документ
   */
  private buildHtmlDocument(pages: string[], settings: BookSettings): string {
    return buildPdfHtmlDocument({
      pages,
      settings,
      theme: this.theme,
      escapeHtml: (value) => this.escapeHtml(value),
    });
  }

  /**
   * Компактная мини-карточка со статистикой путешествия (страна, год, дни, фото, локации)
   */
  private buildStatsMiniCard(
    travel: TravelForBook,
    colors: ReturnType<typeof getThemeConfig>['colors'],
    typography: ReturnType<typeof getThemeConfig>['typography'],
    spacing: ReturnType<typeof getThemeConfig>['spacing']
  ): string {
    return buildPdfStatsMiniCard({
      travel,
      theme: this.theme,
      colors,
      typography,
      spacing,
      escapeHtml: (value) => this.escapeHtml(value),
      formatDays: (days) => this.formatDays(days),
      renderPdfIcon: (name, color, sizePt) => this.renderPdfIcon(name, color, sizePt),
    });
  }

  /**
   * Разделительная страница между путешествиями (при 3+ путешествиях в книге)
   */
  private renderSeparatorPage(travel: TravelForBook, travelIndex: number, totalTravels: number): string {
    return buildPdfSeparatorPage({
      travel,
      travelIndex,
      totalTravels,
      theme: this.theme,
      thumbUrl: this.buildSafeImageUrl(travel.travel_image_thumb_url || travel.travel_image_url),
      formattedDays: this.formatDays(travel.number_days),
      escapeHtml: (value) => this.escapeHtml(value),
      getImageFilterStyle: () => this.getImageFilterStyle(),
    });
  }

  /**
   * Running header для контент-страниц (не для обложки, TOC, фото-страницы и финала)
   */
  private buildRunningHeader(travelName: string, pageNumber: number): string {
    return buildPdfRunningHeader({
      travelName,
      pageNumber,
      theme: this.theme,
      escapeHtml: (value) => this.escapeHtml(value),
    });
  }

  // Вспомогательные методы

  private sortTravels(
    travels: TravelForBook[],
    sortOrder: BookSettings['sortOrder']
  ): TravelForBook[] {
    return sharedSortTravels(travels, sortOrder);
  }

  private getYearRange(travels: TravelForBook[]): string | undefined {
    return sharedGetYearRange(travels);
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
    return sharedBuildTravelMeta({
      travels,
      settings,
      getGalleryPhotosPerPage: (layout, totalPhotos, currentSettings) =>
        this.getGalleryPhotosPerPage(layout, totalPhotos, currentSettings),
    });
  }

  private normalizeLocations(travel: TravelForBook): NormalizedLocation[] {
    return sharedNormalizeLocations(travel);
  }

  private buildRouteSvg(
    locations: NormalizedLocation[],
    options?: { routeLineCoords?: Array<[number, number]> }
  ): string {
    return sharedBuildRouteSvg(locations, this.theme, options);
  }

  private buildMapPlaceholder(): string {
    return sharedBuildMapPlaceholder(this.theme);
  }

  private async generateLocationQRCodes(locations: NormalizedLocation[]): Promise<string[]> {
    const QRCode = await this.getQRCode();
    return Promise.all(
      locations.map(async (location) => {
        const url = sharedBuildGoogleMapsUrl(location);
        if (!url) return '';
        try {
          return await QRCode.toDataURL(url, { margin: 1, scale: 4, width: 120 });
        } catch {
          return '';
        }
      })
    );
  }

  private buildLocationCards(locations: NormalizedLocation[], qrCodes: string[] = []): string[] {
    return buildPdfLocationCards({
      locations,
      qrCodes,
      theme: this.theme,
      showCoordinates: this.currentSettings?.showCoordinatesOnMapPage === true,
      escapeHtml: (value) => this.escapeHtml(value),
      getImageFilterStyle: () => this.getImageFilterStyle(),
    });
  }

  private formatDays(days?: number | null): string {
    return sharedFormatDays(days);
  }

  private getTravelLabel(count: number): string {
    return sharedGetTravelLabel(count);
  }

  private getPhotoLabel(count: number): string {
    return sharedGetPhotoLabel(count);
  }

  private renderPdfIcon(
    name: 'camera' | 'pen' | 'bulb' | 'warning' | 'sparkle' | 'globe' | 'calendar' | 'clock' | 'map-pin',
    color: string,
    sizePt: number
  ): string {
    return sharedRenderPdfIcon(name, color, sizePt);
  }

  private buildSafeImageUrl(url?: string | null): string | undefined {
    return buildSafeImageUrl(url);
  }

  private escapeHtml(value: string | null | undefined): string {
    return sharedEscapeHtml(value);
  }

  /**
   * Получает CSS-фильтр для изображений в зависимости от темы
   */
  private getImageFilterStyle(): string {
    return getImageFilterStyle(this.theme.imageFilter);
  }

  /**
   * Строит изображение с blur-backdrop для сохранения пропорций без обрезки.
   * Blur-слой (object-fit: cover) заполняет фон, основное фото (object-fit: contain) сохраняет пропорции.
   */
  private buildContainImage(
    src: string,
    alt: string,
    height: string,
    opts?: { onerrorBg?: string; extraStyle?: string }
  ): string {
    return buildContainImageMarkup({
      src,
      alt,
      height,
      background: opts?.onerrorBg || this.theme.colors.surfaceAlt,
      filterStyle: this.getImageFilterStyle(),
      extraStyle: opts?.extraStyle || '',
      backdropMode: 'solid',
    });
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
    const mod = await import('../../../parsers/ContentParser');
    this.parser = new mod.ContentParser();
    return this.parser;
  }

  private async ensureBlockRenderer(): Promise<BlockRenderer | null> {
    if (typeof document === 'undefined') return null;
    if (this.blockRenderer) return this.blockRenderer;
    const mod = await import('../../../renderers/BlockRenderer');
    this.blockRenderer = new mod.BlockRenderer(this.theme);
    return this.blockRenderer;
  }

  private async getQRCode(): Promise<{ toDataURL: (text: string, options: Record<string, unknown>) => Promise<string> }> {
    const mod = await import('qrcode');
    const QRCode = (mod as any).default ?? mod;
    return QRCode as any;
  }

  private async getLeafletRouteSnapshot(): Promise<typeof import('@/utils/mapImageGenerator').generateLeafletRouteSnapshot> {
    const mod = await import('@/utils/mapImageGenerator');
    return mod.generateLeafletRouteSnapshot;
  }
}
