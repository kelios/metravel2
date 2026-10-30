import {escapeHtml, buildSafeImageUrl} from '../../../pdf-export/utils/htmlUtils';
import {buildReadyBookPagePlan} from '../validation/index';
import {printProfileSchema, BOOK_PROFILES} from '../../../../data/travelBooks/schema/profiles';
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
}
export interface ReadyBookRenderInput {
  book: EditorialBookDraft;
  profile: PrintProfile;
  purpose: 'read' | 'print-shop';
  assets: Record<string, EmbeddedBookAsset>;
  cover: EmbeddedBookAsset;
  fonts: {regular: string; bold: string; serif: string};
  /** QR is generated locally from the canonical source URL, including its quiet zone. */
  qr: Record<string, string>;
}

export function embeddedImage(value: string): string {
  if (!/^data:image\/(?:jpeg|png|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(value)) {
    throw new Error('Ready books require embedded image bytes');
  }
  return escapeHtml(buildSafeImageUrl(value));
}

/** Fixed physical layouts deliberately bypass private selection, pagination and A4 settings. */
export function buildReadyBookHtml(input: ReadyBookRenderInput) {
  const {book, purpose} = input;
  editorialBookDraftSchema.parse(book);
  const profile = printProfileSchema.parse(input.profile);
  if ((purpose === 'read') !== (profile.bleedMm === 0)) throw new Error('Bleed does not match output purpose');
  for (const stop of book.stops) {
    if (!input.assets[stop.id] || !input.qr[stop.id]) throw new Error(`Missing image or QR: ${stop.id}`);
    embeddedImage(input.assets[stop.id].dataUri);
    embeddedImage(input.qr[stop.id]);
  }
  embeddedImage(input.cover.dataUri);
  const spec = BOOK_PROFILES[profile.id];
  const plan = buildReadyBookPagePlan(book);
  const stylesCss = readyBookStyles(profile, input.fonts, book.country);
  const page = (number: number, kind: string, content: string, component = 'body') => {
    const side = number % 2 === 0 ? 'left' : 'right';
    const heading = kind === 'photo-memory' ? 'Дата ____________ · С кем ____________________' : `${book.country === 'BY' ? 'Беларусь' : 'Польша'} · MeTravel`;
    return `<section class="book-page ${side} ${component} ${kind}" data-folio="${number}" data-kind="${kind}" style="--inner:${profile.bindingMm}mm;--outer:${profile.safeMm}mm"><div class="trim"><header>${escapeHtml(heading)}</header>${content}<footer>${escapeHtml(book.revision)} · RU · ${spec.widthMm}×${spec.heightMm} мм · ${number}</footer></div></section>`;
  };
  const bodyPages = plan.map(entry => {
    const stop = 'stopId' in entry ? book.stops.find(item => item.id === entry.stopId) : undefined;
    return page(entry.number, entry.kind, renderBodyPage(input, entry.kind, stop));
  });
  const coverPages = [1, 2, 3, 4].map(number => page(number, `cover-${number}`, renderCoverPage(input, number), 'cover'));
  const document = (pages: string[]) => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(book.title)}</title><style>${stylesCss}</style></head><body>${pages.join('')}</body></html>`;
  return {bodyHtml: document(bodyPages), coverHtml: document(coverPages), bodyPages, coverPages, stylesCss,
    pageMap: plan.map(entry => ({folio: entry.number, kind: entry.kind, ...('stopId' in entry ? {stopId: entry.stopId} : {})}))};
}
