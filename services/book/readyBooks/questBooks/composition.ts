export const QUEST_BOOK_PAGE_ROLES = ['quest-story', 'quest-map', 'photo-memory', 'notes'] as const;
export type QuestBookPageRole = typeof QUEST_BOOK_PAGE_ROLES[number];
export type QuestBookPage = {number: number; kind: QuestBookPageRole; questId: string};
export type QuestBookVolumePage = {number: number; kind: QuestBookPageRole | 'title' | 'usage' | 'contents' | 'padding' | 'country-map' | 'answers'; questId?: string; questIds?: string[]};

/** Explicit ending pages are supplied only after their content has been agreed. */
export function buildQuestBookPagePlan(book: {quests: readonly {questId: string}[]}, options: {endMatterPages?: readonly ('country-map' | 'answers')[]} = {}): QuestBookVolumePage[] {
  const ids = book.quests.map(quest => quest.questId);
  const contents = Array.from({length: Math.ceil(ids.length / 8)}, (_, index) => ids.slice(index * 8, index * 8 + 8));
  const prefix: Omit<QuestBookVolumePage, 'number'>[] = [{kind: 'title'}, {kind: 'usage'}, ...contents.map(questIds => ({kind: 'contents' as const, questIds}))];
  if (prefix.length % 2 === 0) prefix.push({kind: 'padding'});
  const pages: QuestBookVolumePage[] = prefix.map((page, index) => ({...page, number: index + 1}));
  pages.push(...buildQuestBookBlockPlan(ids, prefix.length + 1));
  for (const kind of options.endMatterPages ?? []) pages.push({kind, number: pages.length + 1});
  if (pages.length % 2) pages.push({kind: 'padding', number: pages.length + 1});
  return pages;
}

/** A quest occupies two complete spreads: information/map, then photo/diary. */
export function buildQuestBookBlockPlan(questIds: readonly string[], firstFolio = 2): QuestBookPage[] {
  if (!Number.isSafeInteger(firstFolio) || firstFolio < 2 || firstFolio % 2 !== 0) {
    throw new Error('Quest blocks must begin on an even left-hand folio');
  }
  if (!questIds.length || questIds.some(id => !id.trim()) || new Set(questIds).size !== questIds.length) {
    throw new Error('Quest blocks require distinct nonempty quest IDs');
  }
  return questIds.flatMap((questId, index) => QUEST_BOOK_PAGE_ROLES.map((kind, offset) => ({
    number: firstFolio + index * QUEST_BOOK_PAGE_ROLES.length + offset, kind, questId,
  })));
}

export function questBookBlockPageCount(questCount: number): number {
  if (!Number.isSafeInteger(questCount) || questCount < 1) throw new Error('Quest count must be a positive integer');
  return questCount * QUEST_BOOK_PAGE_ROLES.length;
}
