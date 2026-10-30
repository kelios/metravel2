import {escapeHtml, buildSafeImageUrl} from '../../../pdf-export/utils/htmlUtils';
import {buildReadyBookPagePlan, MIN_READY_BOOK_STOPS} from '../composition';
import {printProfileSchema} from '../../../../data/travelBooks/schema/profiles';
import {editorialBookDraftSchema} from '../../../../data/travelBooks/schema/editorial';
import type {EditorialBookDraft, PrintProfile} from '../../../../types/readyBook';
import {readyBookStyles} from './styles';
import {renderBodyPage, renderCoverPage} from './pages';

export interface EmbeddedBookAsset {
  dataUri: string;
  credit: string;
  sourceUrl: string;
  licenseUrl?: string;
  rights: string;
  illustrated: boolean;
  changes?: string;
  compactDataUri?: string;
  artworkBounds?: {left: number; top: number; width: number; height: number};
  widthPx?: number; heightPx?: number;
}
export interface ReadyBookRenderInput {
  book: EditorialBookDraft;
  profile: PrintProfile;
  purpose: 'read' | 'print-shop';
  estimatedMinIllustrationPpi?: number;
  assets: Record<string, EmbeddedBookAsset>;
  cover: EmbeddedBookAsset;
  fonts: {regular: string; bold: string; serif: string};
  /** QR is generated locally from the canonical source URL, including its quiet zone. */
  qr: Record<string, {map: string; article: string; quest?: string; sizeMm: number}>;
}

export function embeddedImage(value: string): string {
  if (!/^data:image\/(?:jpeg|png|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(value)) {
    throw new Error('Ready books require embedded image bytes');
  }
  return escapeHtml(buildSafeImageUrl(value));
}

/** Physical editorial layouts are independent of the personal travel-export settings. */
export function buildReadyBookHtml(input: ReadyBookRenderInput) {
  const {book, purpose} = input;
  editorialBookDraftSchema.parse(book);
  if (book.stops.length < MIN_READY_BOOK_STOPS) throw new Error(`Ready books require at least ${MIN_READY_BOOK_STOPS} selected places`);
  const profile = printProfileSchema.parse(input.profile);
  if ((purpose === 'read') !== (profile.bleedMm === 0)) throw new Error('Bleed does not match output purpose');
  for (const stop of book.stops) {
    if (!input.assets[stop.id] || !input.qr[stop.id]) throw new Error(`Missing image or QR: ${stop.id}`);
    if (!Number.isFinite(input.qr[stop.id].sizeMm) || input.qr[stop.id].sizeMm < 22 || input.qr[stop.id].sizeMm > 29) throw new Error(`QR physical size is outside the approved layout: ${stop.id}`);
    if (Boolean(stop.navigation?.quest) !== Boolean(input.qr[stop.id].quest)) throw new Error(`Quest QR lacks matching place association: ${stop.id}`);
    embeddedImage(input.assets[stop.id].dataUri);
    embeddedImage(input.qr[stop.id].map);
    embeddedImage(input.qr[stop.id].article);
    if (input.qr[stop.id].quest) embeddedImage(input.qr[stop.id].quest!);
  }
  embeddedImage(input.cover.dataUri);
  const plan = buildReadyBookPagePlan(book);
  const stylesCss = readyBookStyles(profile, input.fonts);
  const page = (number: number, kind: string, content: string, component = 'body') => {
    const side = number % 2 === 0 ? 'left' : 'right';
    return `<section class="book-page ${profile.id === 'pocket-150x100' ? 'pocket-layout' : 'album-layout'} ${side} ${component} ${kind}" data-folio="${number}" data-kind="${kind}" style="--inner:${profile.bindingMm}mm;--outer:${profile.safeMm}mm"><div class="trim">${content}</div></section>`;
  };
  const bodyPages = plan.map(entry => {
    const stop = 'stopId' in entry ? book.stops.find(item => item.id === entry.stopId) : undefined;
    return page(entry.number, entry.kind, renderBodyPage(input, entry, stop));
  });
  const coverPages = [1, 2, 3, 4].map(number => page(number, `cover-${number}`, renderCoverPage(input, number), 'cover'));
  const document = (pages: string[]) => `<!doctype html><html lang="${escapeHtml(book.contentLocale)}"><head><meta charset="utf-8"><title>${escapeHtml(book.title)}</title><style>${stylesCss}</style></head><body>${pages.join('')}</body></html>`;
  return {bodyHtml: document(bodyPages), coverHtml: document(coverPages), bodyPages, coverPages, stylesCss,
    pageMap: plan.map(({number, ...entry}) => ({folio: number, ...entry}))};
}
