import type { BookDocument } from '@/types/bookDocument'
import type { ParsedContentBlock } from '../parsers/ContentParser'
import { downgradeNonPremiumSettings } from '../premiumSettingsGate'
import { escapeHtml as sharedEscapeHtml } from '../utils/htmlUtils'
import { EnhancedPdfGeneratorBase } from '../generators/v2/runtime/EnhancedPdfGeneratorBase'
import { generateSharedCoverPageMarkup } from '../generators/v2/runtime/coverPage'
import { renderTravelContentPageMarkup } from '../generators/v2/runtime/travelContentPage'
import { renderPdfIcon as sharedRenderPdfIcon } from '../generators/v2/runtime/pdfVisualHelpers'
import { buildEntries as buildAtlasEntries } from '../generators/v2/runtime/atlas/entries'
import { renderAtlasIndexPage, renderAtlasMapPage } from '../generators/v2/runtime/atlas/htmlPages'
import { BOOK_SEGMENT_LIMITS, type BookSegmentPage, type BookPageContext } from './types'
import { translate } from '@/i18n'

/** Single-page facade over the same canonical theme, gates and page renderers. */
export class CanonicalPageRenderer extends EnhancedPdfGeneratorBase {
  /** Canonical markup for one bounded physical page. Worker/DOM adapters stay outside this module. */
  async renderBoundedPage(
    source: BookSegmentPage,
    context: BookPageContext,
    pinned: BookDocument,
  ): Promise<string> {
    if (!Number.isSafeInteger(context.start_page) || context.start_page < 1 || context.folio_area_mm !== 12) {
      throw new Error('SEGMENT_PAGE_CONTEXT_INVALID');
    }
    const settings = downgradeNonPremiumSettings(pinned.settings, pinned.entitlement.premium);
    this.applyPremiumThemeGate(pinned.entitlement.premium);
    this.currentSettings = settings;
    await this.ensureParser();
    await this.ensureBlockRenderer();
    this.initRenderers();
    const number = context.start_page;
    let markup: string;
    switch (source.type) {
      case 'cover':
        markup = await generateSharedCoverPageMarkup(this.theme, { ...source.data, generatedAt: pinned.generated_at });
        break;
      case 'photo': markup = this.renderTravelPhotoPage(source.travel, number); break;
      case 'legacy-content': {
        const chars = [source.travel.description, source.travel.plus, source.travel.minus, source.travel.recommendation]
          .reduce<number>((total, field) => total + (field?.length || 0), 0);
        if (chars > BOOK_SEGMENT_LIMITS.content_chars) throw new Error('SEGMENT_SOURCE_BUDGET_EXCEEDED');
        markup = this.renderTravelContentPage(source.travel, source.qr, number);
        break;
      }
      case 'separator': markup = this.renderSeparatorPage(source.travel, source.ordinal, source.total); break;
      case 'content':
      case 'gallery-caption': {
        if (source.html.length > BOOK_SEGMENT_LIMITS.content_chars) throw new Error('SEGMENT_SOURCE_BUDGET_EXCEEDED');
        if (source.type === 'gallery-caption' && (!settings.includeGallery || settings.showCaptions === false || settings.captionPosition === 'none')) throw new Error('SEGMENT_CAPTION_SETTINGS_MISMATCH');
        if (source.type === 'gallery-caption' && (!Number.isSafeInteger(source.photo_ordinal) || source.photo_ordinal < 1)) throw new Error('SEGMENT_GALLERY_POSITION_INVALID');
        const content = source.type === 'gallery-caption'
          ? { ...source, field: 'description' as const, first: false, last: false, qr: '' }
          : source;
        const contentHtml = source.type === 'gallery-caption'
          ? `<div class="book-gallery-caption-continuation" data-photo-ordinal="${source.photo_ordinal}">
              <h2>${sharedEscapeHtml(translate('export:services.pdfExport.runtime.gallery.photoAlt', { value1: source.photo_ordinal }))}</h2>
              <div class="book-gallery-caption-text" style="white-space: pre-wrap; overflow-wrap: anywhere;">${source.html}</div>
            </div>`
          : source.html;
        const blocks: ParsedContentBlock[] = [{ type: 'paragraph', text: ' ', html: source.html }];
        // Streamed tables/links remain balanced markup. Reparsing a header-only table loses it.
        markup = renderTravelContentPageMarkup({
          travel: { ...source.travel, slug: content.last ? source.travel.slug : undefined, url: content.last ? source.travel.url : undefined }, pageNumber: number, theme: this.theme,
          qrCode: content.last ? content.qr : '', variant: 'runtime',
          descriptionHtml: content.field === 'description' ? contentHtml : '',
          recommendationBlocks: content.field === 'recommendation' ? blocks : [],
          plusBlocks: content.field === 'plus' ? blocks : [],
          minusBlocks: content.field === 'minus' ? blocks : [],
          renderBlocks: () => contentHtml,
          renderPdfIcon: (name, color, size) => sharedRenderPdfIcon(name, color, size),
          escapeHtml: sharedEscapeHtml,
          headerHtml: this.buildRunningHeader(source.travel.name, number),
          statsHtml: content.first ? this.buildStatsMiniCard(source.travel, this.theme.colors, this.theme.typography, this.theme.spacing) : '',
          inlineGalleryHtml: '', showInlineGallery: false, includeGallery: settings.includeGallery, hasGalleryMedia: false,
          applyDropCap: content.first,
        });
        break;
      }
      case 'gallery': {
        const photos = source.travel.gallery || [];
        if (photos.length > BOOK_SEGMENT_LIMITS.gallery_photos) throw new Error('SEGMENT_SOURCE_BUDGET_EXCEEDED');
        const startIndex = source.start_index ?? 0;
        const totalPhotos = source.total_photos ?? source.travel.sourceCounts?.photos ?? photos.length;
        if (!Number.isSafeInteger(startIndex) || startIndex < 0 || !Number.isSafeInteger(totalPhotos) || totalPhotos < startIndex + photos.length ||
          (source.caption_policy !== undefined && !['inline', 'detached'].includes(source.caption_policy))) throw new Error('SEGMENT_GALLERY_POSITION_INVALID');
        this.galleryRenderer.setImageAspects(new Map(Object.entries(source.aspects)));
        // Auto is one measured continuation portion, never an unbounded gallery.
        const pages = this.galleryRenderer.renderPages(source.travel, number, {
          startIndex,
          totalPhotos,
          captionPolicy: source.caption_policy ?? 'inline',
        });
        if (pages.length !== 1) throw new Error('SEGMENT_REQUIRES_SUBDIVISION');
        markup = pages[0];
        break;
      }
      case 'map':
        if (source.locations.length > BOOK_SEGMENT_LIMITS.map_points) throw new Error('SEGMENT_SOURCE_BUDGET_EXCEEDED');
        markup = await this.renderMapPage(source.travel, source.locations, number);
        break;
      case 'toc':
        if (source.entries.length > BOOK_SEGMENT_LIMITS.toc_entries) throw new Error('SEGMENT_SOURCE_BUDGET_EXCEEDED');
        markup = this.renderTocPage(source.entries, number, source.total, source.start);
        break;
      case 'atlas': {
        const count = source.entries.reduce((total, entry) => total + entry.locations.length, 0);
        if (count > BOOK_SEGMENT_LIMITS.atlas_points) throw new Error('SEGMENT_SOURCE_BUDGET_EXCEEDED');
        const entries = buildAtlasEntries(source.entries);
        markup = source.part === 'map'
          ? renderAtlasMapPage({ entries, theme: this.theme, pageNumber: number, totalAtlasPages: source.total_pages, bookTitle: settings.title, escapeHtml: sharedEscapeHtml })
          : renderAtlasIndexPage({ pageEntries: entries, theme: this.theme, pageNumber: number, pageIndex: source.index, totalAtlasPages: source.total_pages, totalPoints: source.total_points, totalTravels: source.total_travels, bookTitle: settings.title, escapeHtml: sharedEscapeHtml });
        break;
      }
      case 'checklists': markup = this.renderChecklistPage(settings, number) || ''; break;
      case 'final':
        markup = this.finalRenderer.render(number, [], source.quote, { summary: source.summary, generatedAt: pinned.generated_at });
        break;
    }
    return this.buildHtmlDocument([markup], settings, pinned.entitlement.premium)
      .replace('</head>', `<style>
        @page { @bottom-center { content: "${number}"; font-variant-numeric: tabular-nums; } }
        .pdf-page { min-height: 285mm !important; }
        .travel-content-page { height: auto !important; overflow: visible !important; }
        .travel-content-page td { overflow-wrap: anywhere; }
        .travel-content-page img { max-width: 100%; max-height: 160mm; object-fit: contain; }
        .travel-content-page table:not(.content-layout) { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .travel-content-page table:not(.content-layout) td, .travel-content-page th { border: 1px solid ${this.theme.colors.border}; padding: 2mm; }
        .travel-content-page pre { white-space: pre-wrap; overflow-wrap: anywhere; }
      </style></head>`);
  }

}
