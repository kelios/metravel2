import catalogue from '@/data/travelBooks/series/catalog.json';
import type {BookSeries} from '@/types/readyBook';
import type {ReadyBookSummary} from './bookMetadata';

export type CatalogueTheme = 'all' | 'mixed' | 'castles' | 'mountains' | 'quests';
// The kits and their full source evidence never enter the initial catalogue bundle.
export const bookSeries = catalogue.series as BookSeries[];

export function catalogueTheme(book: ReadyBookSummary): Exclude<CatalogueTheme, 'all'> {
  if (book.kind === 'quests') return 'quests';
  return 'sourceContract' in book && book.sourceContract === 'thematic-v1' ? book.theme : 'mixed';
}

export function selectCatalogue(books: ReadyBookSummary[], series: BookSeries[], theme: CatalogueTheme) {
  const available = books.filter(book => {
    if ('sourceContract' in book && book.sourceContract === 'thematic-v1') {
      const owner = series.find(item => item.id === book.seriesId);
      if (!owner || owner.status !== 'ready' || owner.theme !== book.theme || !owner.bookIds.includes(book.id)) return false;
    }
    return theme === 'all' || catalogueTheme(book) === theme;
  });
  const planned = series.filter(item => (theme === 'all' || item.theme === theme) &&
    (item.status !== 'ready' || !item.bookIds.every(id => available.some(book => book.id === id))));
  return {available, planned};
}
