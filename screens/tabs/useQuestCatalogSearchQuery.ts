import { useMemo, useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { createQuestCatalogSearch, type QuestCatalogSearchResult } from '@/utils/questCatalogSearch';
import type { QuestMeta } from '@/utils/questAdapters';

/** Keep typing immediate while catalogue matching waits for a pause (#1826). */
export function useQuestCatalogSearchQuery() {
    const [searchQuery, setSearchQuery] = useState('');
    const searchTerm = useDebouncedValue(searchQuery.trim().toLowerCase(), 200);

    return { searchQuery, setSearchQuery, searchTerm };
}

/** Поисковая выдача по всему каталогу (#3239); `null` — поиск не активен. */
export function useQuestCatalogSearchResult<T extends QuestMeta>(
    quests: T[],
    canonicalCityIdById: Record<string, string>,
    searchTerm: string,
    ready: boolean,
): QuestCatalogSearchResult<T> | null {
    // Индекс строится один раз на каталог, а не на каждый символ запроса.
    const search = useMemo(() => createQuestCatalogSearch(quests, canonicalCityIdById), [quests, canonicalCityIdById]);
    return useMemo(() => (ready && searchTerm ? search(searchTerm) : null), [ready, searchTerm, search]);
}
