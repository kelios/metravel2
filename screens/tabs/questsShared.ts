import { selectPlural, translate as i18nT } from '@/i18n'
export type City = {
    id: string;
    name: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
};

export type NearbyCity = City & { isNearby: true };

export type { QuestMeta } from '@/utils/questAdapters';

export const pluralizeQuest = (n: number): string => {
    return selectPlural(n, {
        one: i18nT('shared:screens.tabs.questsShared.value1_kvest_ba4b63c8', { value1: n }),
        few: i18nT('shared:screens.tabs.questsShared.value1_kvesta_d13d13d5', { value1: n }),
        many: i18nT('shared:screens.tabs.questsShared.value1_kvestov_78e37d31', { value1: n }),
        other: i18nT('shared:screens.tabs.questsShared.value1_kvestov_78e37d31', { value1: n }),
    });
};

export const pluralizePoints = (n: number): string => {
    return selectPlural(n, {
        one: i18nT('shared:screens.tabs.questsShared.value1_tochka_e01ea7fd', { value1: n }),
        few: i18nT('shared:screens.tabs.questsShared.value1_tochki_7a70f439', { value1: n }),
        many: i18nT('shared:screens.tabs.questsShared.value1_tochek_590c7277', { value1: n }),
        other: i18nT('shared:screens.tabs.questsShared.value1_tochek_590c7277', { value1: n }),
    });
};
