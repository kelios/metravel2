// src/services/pdf-export/quotes/travelQuotes.ts
// Набор travel-цитат для обложки и финальной страницы книги

import { translate as i18nT, type TranslationKey } from '@/i18n';

export interface TravelQuote {
  text: string;
  author?: string;
}

type QuoteKeys = readonly [TranslationKey, TranslationKey];

const TRAVEL_QUOTE_KEYS = [
  ['export:services.pdfExport.quotes.travel.q01.text', 'export:services.pdfExport.quotes.travel.q01.author'],
  ['export:services.pdfExport.quotes.travel.q02.text', 'export:services.pdfExport.quotes.travel.q02.author'],
  ['export:services.pdfExport.quotes.travel.q03.text', 'export:services.pdfExport.quotes.travel.q03.author'],
  ['export:services.pdfExport.quotes.travel.q04.text', 'export:services.pdfExport.quotes.travel.q04.author'],
  ['export:services.pdfExport.quotes.travel.q05.text', 'export:services.pdfExport.quotes.travel.q05.author'],
  ['export:services.pdfExport.quotes.travel.q06.text', 'export:services.pdfExport.quotes.travel.q06.author'],
  ['export:services.pdfExport.quotes.travel.q07.text', 'export:services.pdfExport.quotes.travel.q07.author'],
  ['export:services.pdfExport.quotes.travel.q08.text', 'export:services.pdfExport.quotes.travel.q08.author'],
  ['export:services.pdfExport.quotes.travel.q09.text', 'export:services.pdfExport.quotes.travel.q09.author'],
  ['export:services.pdfExport.quotes.travel.q10.text', 'export:services.pdfExport.quotes.travel.q10.author'],
  ['export:services.pdfExport.quotes.travel.q11.text', 'export:services.pdfExport.quotes.travel.q11.author'],
  ['export:services.pdfExport.quotes.travel.q12.text', 'export:services.pdfExport.quotes.travel.q12.author'],
  ['export:services.pdfExport.quotes.travel.q13.text', 'export:services.pdfExport.quotes.travel.q13.author'],
  ['export:services.pdfExport.quotes.travel.q14.text', 'export:services.pdfExport.quotes.travel.q14.author'],
  ['export:services.pdfExport.quotes.travel.q15.text', 'export:services.pdfExport.quotes.travel.q15.author'],
  ['export:services.pdfExport.quotes.travel.q16.text', 'export:services.pdfExport.quotes.travel.q16.author'],
  ['export:services.pdfExport.quotes.travel.q17.text', 'export:services.pdfExport.quotes.travel.q17.author'],
  ['export:services.pdfExport.quotes.travel.q18.text', 'export:services.pdfExport.quotes.travel.q18.author'],
  ['export:services.pdfExport.quotes.travel.q19.text', 'export:services.pdfExport.quotes.travel.q19.author'],
  ['export:services.pdfExport.quotes.travel.q20.text', 'export:services.pdfExport.quotes.travel.q20.author'],
  ['export:services.pdfExport.quotes.travel.q21.text', 'export:services.pdfExport.quotes.travel.q21.author'],
  ['export:services.pdfExport.quotes.travel.q22.text', 'export:services.pdfExport.quotes.travel.q22.author'],
  ['export:services.pdfExport.quotes.travel.q23.text', 'export:services.pdfExport.quotes.travel.q23.author'],
  ['export:services.pdfExport.quotes.travel.q24.text', 'export:services.pdfExport.quotes.travel.q24.author'],
  ['export:services.pdfExport.quotes.travel.q25.text', 'export:services.pdfExport.quotes.travel.q25.author'],
  ['export:services.pdfExport.quotes.travel.q26.text', 'export:services.pdfExport.quotes.travel.q26.author'],
  ['export:services.pdfExport.quotes.travel.q27.text', 'export:services.pdfExport.quotes.travel.q27.author'],
  ['export:services.pdfExport.quotes.travel.q28.text', 'export:services.pdfExport.quotes.travel.q28.author'],
  ['export:services.pdfExport.quotes.travel.q29.text', 'export:services.pdfExport.quotes.travel.q29.author'],
  ['export:services.pdfExport.quotes.travel.q30.text', 'export:services.pdfExport.quotes.travel.q30.author'],
  ['export:services.pdfExport.quotes.travel.q31.text', 'export:services.pdfExport.quotes.travel.q31.author'],
  ['export:services.pdfExport.quotes.travel.q32.text', 'export:services.pdfExport.quotes.travel.q32.author'],
  ['export:services.pdfExport.quotes.travel.q33.text', 'export:services.pdfExport.quotes.travel.q33.author'],
  ['export:services.pdfExport.quotes.travel.q34.text', 'export:services.pdfExport.quotes.travel.q34.author'],
  ['export:services.pdfExport.quotes.travel.q35.text', 'export:services.pdfExport.quotes.travel.q35.author'],
  ['export:services.pdfExport.quotes.travel.q36.text', 'export:services.pdfExport.quotes.travel.q36.author'],
  ['export:services.pdfExport.quotes.travel.q37.text', 'export:services.pdfExport.quotes.travel.q37.author'],
  ['export:services.pdfExport.quotes.travel.q38.text', 'export:services.pdfExport.quotes.travel.q38.author'],
  ['export:services.pdfExport.quotes.travel.q39.text', 'export:services.pdfExport.quotes.travel.q39.author'],
  ['export:services.pdfExport.quotes.travel.q40.text', 'export:services.pdfExport.quotes.travel.q40.author'],
  ['export:services.pdfExport.quotes.travel.q41.text', 'export:services.pdfExport.quotes.travel.q41.author'],
  ['export:services.pdfExport.quotes.travel.q42.text', 'export:services.pdfExport.quotes.travel.q42.author'],
  ['export:services.pdfExport.quotes.travel.q43.text', 'export:services.pdfExport.quotes.travel.q43.author'],
  ['export:services.pdfExport.quotes.travel.q44.text', 'export:services.pdfExport.quotes.travel.q44.author'],
  ['export:services.pdfExport.quotes.travel.q45.text', 'export:services.pdfExport.quotes.travel.q45.author'],
  ['export:services.pdfExport.quotes.travel.q46.text', 'export:services.pdfExport.quotes.travel.q46.author'],
  ['export:services.pdfExport.quotes.travel.q47.text', 'export:services.pdfExport.quotes.travel.q47.author'],
  ['export:services.pdfExport.quotes.travel.q48.text', 'export:services.pdfExport.quotes.travel.q48.author'],
  ['export:services.pdfExport.quotes.travel.q49.text', 'export:services.pdfExport.quotes.travel.q49.author'],
  ['export:services.pdfExport.quotes.travel.q50.text', 'export:services.pdfExport.quotes.travel.q50.author'],
] as const satisfies readonly QuoteKeys[];

const GALLERY_QUOTE_KEYS = [
  ['export:services.pdfExport.quotes.gallery.q01.text', 'export:services.pdfExport.quotes.gallery.q01.author'],
  ['export:services.pdfExport.quotes.gallery.q02.text', 'export:services.pdfExport.quotes.gallery.q02.author'],
  ['export:services.pdfExport.quotes.gallery.q03.text', 'export:services.pdfExport.quotes.gallery.q03.author'],
  ['export:services.pdfExport.quotes.gallery.q04.text', 'export:services.pdfExport.quotes.gallery.q04.author'],
  ['export:services.pdfExport.quotes.gallery.q05.text', 'export:services.pdfExport.quotes.gallery.q05.author'],
  ['export:services.pdfExport.quotes.gallery.q06.text', 'export:services.pdfExport.quotes.gallery.q06.author'],
  ['export:services.pdfExport.quotes.gallery.q07.text', 'export:services.pdfExport.quotes.gallery.q07.author'],
  ['export:services.pdfExport.quotes.gallery.q08.text', 'export:services.pdfExport.quotes.gallery.q08.author'],
  ['export:services.pdfExport.quotes.gallery.q09.text', 'export:services.pdfExport.quotes.gallery.q09.author'],
  ['export:services.pdfExport.quotes.gallery.q10.text', 'export:services.pdfExport.quotes.gallery.q10.author'],
  ['export:services.pdfExport.quotes.gallery.q11.text', 'export:services.pdfExport.quotes.gallery.q11.author'],
  ['export:services.pdfExport.quotes.gallery.q12.text', 'export:services.pdfExport.quotes.gallery.q12.author'],
  ['export:services.pdfExport.quotes.gallery.q13.text', 'export:services.pdfExport.quotes.gallery.q13.author'],
  ['export:services.pdfExport.quotes.gallery.q14.text', 'export:services.pdfExport.quotes.gallery.q14.author'],
  ['export:services.pdfExport.quotes.gallery.q15.text', 'export:services.pdfExport.quotes.gallery.q15.author'],
  ['export:services.pdfExport.quotes.gallery.q16.text', 'export:services.pdfExport.quotes.gallery.q16.author'],
] as const satisfies readonly QuoteKeys[];

function createQuote([textKey, authorKey]: QuoteKeys): TravelQuote {
  return {
    get text() {
      return i18nT(textKey);
    },
    get author() {
      return i18nT(authorKey);
    },
  };
}

export const TRAVEL_QUOTES: TravelQuote[] = TRAVEL_QUOTE_KEYS.map(createQuote);
export const GALLERY_QUOTES: TravelQuote[] = GALLERY_QUOTE_KEYS.map(createQuote);

export function pickRandomQuote(exclude?: TravelQuote): TravelQuote {
  const pool = exclude
    ? TRAVEL_QUOTES.filter((q) => q.text !== exclude.text || q.author !== exclude.author)
    : TRAVEL_QUOTES;

  if (pool.length === 0) {
    return TRAVEL_QUOTES[0];
  }

  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

export function pickRandomGalleryQuote(): TravelQuote {
  const pool = GALLERY_QUOTES.length ? GALLERY_QUOTES : TRAVEL_QUOTES;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}
