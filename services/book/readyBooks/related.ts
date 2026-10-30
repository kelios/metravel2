import summaries from '@/data/travelBooks/related.json';

export type RelatedBookSummary = {
  country: 'BY' | 'PL';
  slug: string;
  title: string;
  sourceTravelIds: number[];
  pointIds: number[];
  questIds?: number[];
};

export type BookSource = {
  sourceTravelId?: unknown;
  pointId?: unknown;
  questId?: unknown;
};

const positiveId = (value: unknown): number | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  if (typeof value === 'string' && !/^\d+$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
};

// The compact index contains only verified author-1 sources from the published
// books. A shared country or city does not establish a place association.
export function relatedBookForSource(source: BookSource) {
  const travelId = positiveId(source.sourceTravelId);
  const pointId = positiveId(source.pointId);
  const questId = positiveId(source.questId);
  return (summaries as RelatedBookSummary[]).find(book =>
    (pointId !== undefined && book.pointIds.includes(pointId)) ||
    (travelId !== undefined && book.sourceTravelIds.includes(travelId)) ||
    (questId !== undefined && book.questIds?.includes(questId)),
  );
}
