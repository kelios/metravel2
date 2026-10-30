/** One logical page contract shared by rendering, schemas, imposition and publication. */
export const MIN_READY_BOOK_STOPS = 30;
export const COVER_PAGE_COUNT = 4;
export const CONTENTS_PER_PAGE = 8;
export const STOP_PAGE_ROLES = ['destination', 'photo-memory', 'notes'] as const;
export type ReadyBookPageRole = typeof STOP_PAGE_ROLES[number] | 'title' | 'preparation' | 'usage' | 'contents' | 'map' | 'extra-memory' | 'checklist' | 'credits' | 'padding';
export type ReadyBookPage = {number: number; kind: ReadyBookPageRole; stopId?: string; stopIds?: string[]};

export function padPageCount(count: number, multiple = 2): number {
  if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(multiple) || multiple < 1) throw new Error('Page counts must be positive integers');
  return Math.ceil(count / multiple) * multiple;
}

export function buildReadyBookPagePlan(book: {stops: readonly {id: string}[]; layoutVersion?: 1 | 2}): ReadyBookPage[] {
  if (!book.stops.length || new Set(book.stops.map(stop => stop.id)).size !== book.stops.length) throw new Error('A book needs distinct selected places');
  const ids = book.stops.map(stop => stop.id);
  const chunks = Array.from({length: Math.ceil(ids.length / CONTENTS_PER_PAGE)}, (_, index) => ids.slice(index * CONTENTS_PER_PAGE, (index + 1) * CONTENTS_PER_PAGE));
  const legacyLayout = book.layoutVersion === 1;
  const checklistPages = chunks.map(stopIds => ({kind: 'checklist' as const, stopIds}));
  const pages: Omit<ReadyBookPage, 'number'>[] = [
    {kind: 'title'}, {kind: 'preparation'}, {kind: 'usage'},
    ...chunks.map(stopIds => ({kind: 'contents' as const, stopIds})),
    ...(legacyLayout ? [{kind: 'map' as const}] : []),
    ...ids.flatMap(stopId => STOP_PAGE_ROLES.map(kind => ({kind, stopId}))),
    {kind: 'extra-memory'},
    ...(legacyLayout
      ? [...checklistPages, {kind: 'credits' as const}]
      : [{kind: 'credits' as const}, ...checklistPages, {kind: 'map' as const}]),
  ];
  if (pages.length % 2) pages.push({kind: 'padding'});
  return pages.map((page, index) => ({number: index + 1, ...page}));
}

export function readyBookBodyPageCount(stopCount: number): number {
  if (!Number.isSafeInteger(stopCount) || stopCount < 1) throw new Error('A book needs a positive selected-place count');
  return padPageCount(6 + 2 * Math.ceil(stopCount / CONTENTS_PER_PAGE) + stopCount * STOP_PAGE_ROLES.length);
}

export function signatureSizes(pageCount: number): number[] {
  let remaining = padPageCount(pageCount, 4);
  const sizes: number[] = [];
  while (remaining > 0) {const size = Math.min(16, remaining); sizes.push(size); remaining -= size;}
  return sizes;
}
