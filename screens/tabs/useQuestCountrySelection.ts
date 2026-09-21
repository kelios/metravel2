import { useCallback, useEffect, useMemo, useState } from 'react';

import { createCollator } from '@/i18n';
import { parseCountrySelectionId } from '@/utils/questCatalogSelection';
import { getQuestCountryName, type QuestCatalogCity } from './QuestsScreen.helpers';

/** Страна сайдбара каталога: код ISO (`OTHER` — города без кода страны), имя и её города. */
export type QuestCountryGroup = {
    code: string;
    name: string;
    cities: QuestCatalogCity[];
};

/** Сборная группа городов без кода страны: у неё нет имени и нет пункта «вся страна». */
export const OTHER_COUNTRY_CODE = 'OTHER';

export type SelectedQuestCountry<TQuest> = {
    code: string;
    name: string;
    quests: TQuest[];
};

export type QuestCountrySelection<TQuest> = {
    /** Страна, в которой лежит активный выбор: выбранная целиком или страна выбранного города. */
    activeCountryCode: string | null;
    /** Выбранная целиком страна — только если она есть в каталоге и в ней есть квесты. */
    selectedCountry: SelectedQuestCountry<TQuest> | null;
};

/** Беларусь первой, дальше по алфавиту текущего языка, города без страны — в конце. */
export function groupQuestCitiesByCountry(cities: QuestCatalogCity[]): QuestCountryGroup[] {
    const collator = createCollator();
    const groups: Record<string, QuestCatalogCity[]> = {};
    for (const city of cities) {
        const code = city.countryCode || OTHER_COUNTRY_CODE;
        (groups[code] ||= []).push(city);
    }
    const sortedCodes = Object.keys(groups).sort((a, b) => {
        if (a === 'BY') return -1;
        if (b === 'BY') return 1;
        if (a === OTHER_COUNTRY_CODE) return 1;
        if (b === OTHER_COUNTRY_CODE) return -1;
        return collator.compare(getQuestCountryName(a), getQuestCountryName(b));
    });
    return sortedCodes.map((code) => ({
        code,
        name: code === OTHER_COUNTRY_CODE ? '' : getQuestCountryName(code),
        cities: groups[code].slice().sort((a, b) => collator.compare(a.name, b.name)),
    }));
}

/**
 * Квесты страны берутся из тех же городов, по которым сайдбар считает её счётчик: число на
 * пункте «Все квесты страны» и число карточек в сетке совпадают по построению, а не по поводу.
 */
export function resolveQuestCountrySelection<TQuest>(
    selectedId: string | null,
    countryGroups: QuestCountryGroup[],
    questsByCityId: Record<string, TQuest[]>,
): QuestCountrySelection<TQuest> {
    const countryCode = parseCountrySelectionId(selectedId);
    if (countryCode) {
        const group = countryCode === OTHER_COUNTRY_CODE
            ? undefined
            : countryGroups.find((candidate) => candidate.code === countryCode);
        if (!group) return { activeCountryCode: null, selectedCountry: null };
        const seen = new Set<TQuest>();
        const quests: TQuest[] = [];
        for (const city of group.cities) {
            for (const quest of questsByCityId[city.id] ?? []) {
                if (seen.has(quest)) continue;
                seen.add(quest);
                quests.push(quest);
            }
        }
        return {
            activeCountryCode: group.code,
            selectedCountry: quests.length > 0 ? { code: group.code, name: group.name, quests } : null,
        };
    }
    if (!selectedId) return { activeCountryCode: null, selectedCountry: null };
    const group = countryGroups.find((candidate) => candidate.cities.some((city) => city.id === selectedId));
    return { activeCountryCode: group?.code ?? null, selectedCountry: null };
}

/**
 * Страны сайдбара каталога: группы, выбор страны целиком и раскрытие.
 *
 * Страны свёрнуты по умолчанию; страна активного выбора раскрывается один раз на смену выбора —
 * в том числе восстановленного из хранилища, — и пользователь может свернуть её снова, не получая
 * повторного раскрытия. Раскрытие не сохраняется: его выводит сам выбор.
 */
export function useQuestCountrySelection<TQuest>(
    selectedId: string | null,
    cities: QuestCatalogCity[],
    questsByCityId: Record<string, TQuest[]>,
) {
    const countryGroups = useMemo(() => groupQuestCitiesByCountry(cities), [cities]);
    const { activeCountryCode, selectedCountry } = useMemo(
        () => resolveQuestCountrySelection(selectedId, countryGroups, questsByCityId),
        [countryGroups, questsByCityId, selectedId],
    );
    const [expandedCountryCodes, setExpandedCountryCodes] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!activeCountryCode) return;
        setExpandedCountryCodes((prev) => (prev[activeCountryCode] ? prev : { ...prev, [activeCountryCode]: true }));
    }, [activeCountryCode]);

    // Полная карта по всем группам: сайдбару не нужно знать, что неизвестная страна свёрнута.
    const collapsedCountryCodes = useMemo(() => {
        const collapsed: Record<string, boolean> = {};
        for (const group of countryGroups) collapsed[group.code] = !expandedCountryCodes[group.code];
        return collapsed;
    }, [countryGroups, expandedCountryCodes]);

    const areAllCountryGroupsCollapsed = useMemo(
        () => countryGroups.length > 0 && countryGroups.every((group) => collapsedCountryCodes[group.code]),
        [collapsedCountryCodes, countryGroups],
    );

    const toggleCountryGroup = useCallback((code: string) => {
        setExpandedCountryCodes((prev) => ({ ...prev, [code]: !prev[code] }));
    }, []);

    const toggleAllCountryGroups = useCallback(() => {
        if (!areAllCountryGroupsCollapsed) {
            setExpandedCountryCodes({});
            return;
        }
        const expanded: Record<string, boolean> = {};
        for (const group of countryGroups) expanded[group.code] = true;
        setExpandedCountryCodes(expanded);
    }, [areAllCountryGroupsCollapsed, countryGroups]);

    return {
        countryGroups,
        activeCountryCode,
        selectedCountry,
        collapsedCountryCodes,
        areAllCountryGroupsCollapsed,
        toggleCountryGroup,
        toggleAllCountryGroups,
    };
}
