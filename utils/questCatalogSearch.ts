// utils/questCatalogSearch.ts
// Свободный поиск каталога квестов (экран «Квесты»).

import type { QuestMeta } from '@/utils/questAdapters';
import { getQuestAgeSearchTerms } from '@/utils/questAudience';

/**
 * Совпадает ли квест с поисковым запросом (уже `trim().toLowerCase()`).
 * Город ищется по обоим названиям (#2198): локализованное приходит с `?lang=`
 * («Kraków»), каноническое — язык источника («Краков»), и запрос на любом из
 * них находит город независимо от языка интерфейса.
 */
export function questMatchesSearch(quest: QuestMeta, searchTerm: string): boolean {
    const haystack = [
        quest.title,
        quest.cityName,
        quest.cityNameCanonical,
        quest.countryName,
        ...(quest.tags || []),
        ...getQuestAgeSearchTerms(quest.tags),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return haystack.includes(searchTerm);
}
