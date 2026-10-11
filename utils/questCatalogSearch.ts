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

export type QuestCatalogSearch = (quest: QuestMeta, searchTerm: string) => boolean;

/**
 * Поиск по каталогу целиком (#2198). Город квеста сверяется со всеми его
 * названиями, известными каталогу: у непереведённого квеста `cityName` —
 * русский источник, и «Kraków» ему приносит переведённый квест того же города.
 * Город определяется каноническим id (`buildCanonicalQuestCityIndex`), поэтому
 * одна запись под двумя `city_id` тоже ищется целиком.
 */
export function createQuestCatalogSearch(
    quests: QuestMeta[],
    canonicalCityIdById: Record<string, string>,
): QuestCatalogSearch {
    const cityKey = (quest: QuestMeta) => canonicalCityIdById[quest.cityId] ?? quest.cityId;
    const namesByCity = new Map<string, Set<string>>();
    for (const quest of quests) {
        const names = namesByCity.get(cityKey(quest)) ?? new Set<string>();
        for (const name of [quest.cityName, quest.cityNameCanonical]) {
            if (name) names.add(name.toLowerCase());
        }
        namesByCity.set(cityKey(quest), names);
    }
    const cityText = new Map([...namesByCity].map(([key, names]) => [key, [...names].join(' ')]));
    return (quest, searchTerm) =>
        questMatchesSearch(quest, searchTerm) || Boolean(cityText.get(cityKey(quest))?.includes(searchTerm));
}
