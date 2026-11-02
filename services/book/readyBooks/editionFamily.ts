type EditionIdentity = {
  kind?: 'places' | 'quests'; country: 'BY' | 'PL'; visualStyle?: string;
  sourceContract?: 'thematic-v1'; seriesId?: string; volume?: number;
};

/** Declared editorial families keep theme editions out of country style alternatives. */
export function editionFamily(book: EditionIdentity): string {
  if (book.kind === 'quests') return `quests:${book.country}:${book.seriesId}:${book.volume}`;
  return book.sourceContract === 'thematic-v1'
    ? `places:${book.country}:series:${book.seriesId}`
    : `places:${book.country}:country`;
}

export function editionIdentity(book: EditionIdentity): string {
  return book.kind === 'quests' ? editionFamily(book) : `${editionFamily(book)}:${book.visualStyle ?? 'watercolor'}`;
}
