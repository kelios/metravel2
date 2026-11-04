import catalogue from '@/data/travelBooks/series/catalog.json';
import type {BookSeries} from '@/types/readyBook';
import type {ReadyBookSummary} from './bookMetadata';
import {editionFamily} from './editionFamily';

export type CatalogueTheme = 'all' | 'mixed' | 'castles' | 'mountains' | 'quests';
export type CatalogueCountry = 'all' | ReadyBookSummary['country'];
// The kits and their full source evidence never enter the initial catalogue bundle.
export const bookSeries = catalogue.series as BookSeries[];

export function catalogueTheme(book: ReadyBookSummary): Exclude<CatalogueTheme, 'all'> {
  if (book.kind === 'quests') return 'quests';
  return 'sourceContract' in book && book.sourceContract === 'thematic-v1' ? book.theme : 'mixed';
}

export function selectCatalogue(books: ReadyBookSummary[], series: BookSeries[], theme: CatalogueTheme, country: CatalogueCountry = 'all') {
  const published = books.filter(book => {
    if ('sourceContract' in book && book.sourceContract === 'thematic-v1') {
      const owner = series.find(item => item.id === book.seriesId);
      if (!owner || owner.status !== 'ready' || owner.theme !== book.theme || !owner.bookIds.includes(book.id)) return false;
    }
    return true;
  });
  const available = published.filter(book => (country === 'all' || book.country === country) &&
    (theme === 'all' || catalogueTheme(book) === theme));
  const planned = series.filter(item => (country === 'all' || item.countries.includes(country)) && (theme === 'all' || item.theme === theme) &&
    (item.status !== 'ready' || !item.bookIds.every(id => published.some(book => book.id === id))));
  return {available, planned};
}

export function groupCatalogue(books: ReadyBookSummary[]) {
  const families = new Map<string, ReadyBookSummary[]>();
  for (const book of books) {
    const key = catalogueTheme(book) === 'mixed' ? editionFamily(book) : book.id;
    const variants = families.get(key) ?? [];
    variants.push(book);
    families.set(key, variants);
  }
  return [...families.values()];
}
