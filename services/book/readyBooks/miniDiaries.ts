import discovery from '@/data/travelBooks/mini-diaries/discovery.json';
import type {MiniDiary} from '@/data/travelBooks/schema/miniDiaries';
import type {CatalogueCountry, CatalogueTheme} from './seriesCatalog';

// Discovery belongs to the website; changing a filter must not rewrite an immutable PDF edition.
export function selectMiniDiaries(diaries: MiniDiary[], theme: CatalogueTheme, country: CatalogueCountry) {
  return diaries.filter(diary => (country === 'all' || diary.country === country) &&
    (theme === 'all' || discovery.diaries.find(entry => entry.id === diary.id)?.theme === theme));
}

export function miniDiaryTrips(diary: MiniDiary) {
  return diary.stops.map((stop, index) => ({
    ...stop,
    page: index + 3,
    pdfUrl: `${diary.pdf.uri}#page=${index + 3}`,
    sourceKind: new URL(stop.articleUrl).pathname.startsWith('/quests/') ? 'quest' as const : 'article' as const,
  }));
}
