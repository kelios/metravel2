import type { NavigationIconName } from '@/constants/navigationIcons';
import { getSeasonalThemeByCalendar, type SeasonalThemeId } from '@/constants/seasonalThemes';

export type QuestThemeId = 'halloween' | 'christmas' | 'legends' | 'detective' | 'fairytale';

export type QuestThemeDefinition = {
    id: QuestThemeId;
    /** Канонические теги `meta.tags`, любой из которых включает квест в тему. */
    tags: readonly string[];
    icon: NavigationIconName;
    /**
     * Сезон подборки = сезон оформления сайта (#2376): окно дат берётся из
     * `SEASONAL_THEMES` по этому id, чтобы «сайт переоделся» и «подборка
     * появилась» случались для человека в один день и считались в одном месте.
     */
    season?: SeasonalThemeId;
    readonly labelKey: string;
};

// Порядок реестра = порядок показа: сезонные темы впереди вечных, чтобы в свой
// сезон подборка стояла первой и в сайдбаре, и среди чипов, и в выборе бейджа.
const QUEST_THEMES: readonly QuestThemeDefinition[] = [
    {
        id: 'halloween',
        tags: ['halloween'],
        icon: 'moon',
        season: 'halloween',
        labelKey: 'quests:utils.questThemes.halloween',
    },
    {
        id: 'christmas',
        tags: ['christmas'],
        icon: 'gift',
        season: 'christmas',
        labelKey: 'quests:utils.questThemes.christmas',
    },
    {
        id: 'legends',
        tags: ['mystic', 'myth', 'mystery', 'ghost'],
        icon: 'feather',
        labelKey: 'quests:utils.questThemes.legends',
    },
    {
        id: 'detective',
        tags: ['detective'],
        icon: 'search',
        labelKey: 'quests:utils.questThemes.detective',
    },
    {
        id: 'fairytale',
        tags: ['fairytale'],
        icon: 'book-open',
        labelKey: 'quests:utils.questThemes.fairytale',
    },
];

export function getQuestThemeDefinitions(): readonly QuestThemeDefinition[] {
    return QUEST_THEMES;
}

export function getQuestThemeDefinitionById(id: string | null | undefined): QuestThemeDefinition | null {
    if (!id) return null;
    return QUEST_THEMES.find((theme) => theme.id === id) ?? null;
}

/**
 * Вечная тема активна всегда; сезонная — только в окне одноимённого сезона
 * оформления (локальная дата клиента). Сезон без записи в `SEASONAL_THEMES`
 * считается неактивным: подборка молча не появится, а не покажется круглый год.
 */
export function isQuestThemeActive(theme: Pick<QuestThemeDefinition, 'season'>, now: Date = new Date()): boolean {
    if (!theme.season) return true;
    return getSeasonalThemeByCalendar(now) === theme.season;
}

