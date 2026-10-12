import type { NavigationIconName } from '@/constants/navigationIcons';
import { SEASONAL_THEMES, getSeasonalThemeByCalendar, type SeasonalThemeId } from '@/constants/seasonalThemes';
import type { SeasonalMonthDay } from '@/utils/seasonalCalendarCore';

export type QuestThemeId = 'halloween' | 'christmas' | 'legends' | 'detective' | 'fairytale';

export type QuestThemeDefinition = {
    id: QuestThemeId;
    /** Канонические теги `meta.tags`, любой из которых включает квест в тему. */
    tags: readonly string[];
    icon: NavigationIconName;
    /**
     * Сезон подборки = сезон оформления сайта (#2376): окно дат берётся из
     * `SEASONAL_THEMES` по этому id, чтобы «сайт переоделся» всегда означало
     * «подборка уже есть» и считалось в одном месте.
     */
    season?: SeasonalThemeId;
    /**
     * Ранний показ подборки (#2409): с этой даты до конца окна сезона
     * оформления. Витрина появляется раньше, чем сайт «переодевается», —
     * праздничные поездки планируют заранее. Без поля — только окно сезона.
     */
    previewFrom?: SeasonalMonthDay;
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
        previewFrom: { month: 10, day: 1 },
        labelKey: 'quests:utils.questThemes.halloween',
    },
    {
        id: 'christmas',
        tags: ['christmas'],
        icon: 'gift',
        season: 'christmas',
        previewFrom: { month: 11, day: 15 },
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

export type QuestThemePreviewWindow = { from: SeasonalMonthDay; to: SeasonalMonthDay };

/**
 * Окно раннего показа: `previewFrom` → конец фиксированного окна сезона
 * оформления. Сезон без фиксированного правила (Пасха) окна не получает.
 */
export function getQuestThemePreviewWindow(
    theme: Pick<QuestThemeDefinition, 'season' | 'previewFrom'>,
): QuestThemePreviewWindow | null {
    if (!theme.season || !theme.previewFrom) return null;
    const season = SEASONAL_THEMES.find((entry) => entry.id === theme.season);
    for (const rule of season?.rules ?? []) {
        if (rule.kind === 'fixedAnnual') return { from: theme.previewFrom, to: rule.to };
    }
    return null;
}

/**
 * Единственный предикат активности темы. Самодостаточная ES5-функция без
 * замыканий: стартовый скрипт `/quests` (`getQuestCatalogRestoredSelectionScript`)
 * встраивает её через `toString()`, поэтому правило не дублируется в двух языках.
 * Тема активна, если она вечная; если её сезон совпал с сезоном календаря или
 * с сезоном оформления сайта (ручной выбор темы — «сайт переоделся = подборка
 * появилась»); если дата в окне раннего показа. Окно с `to < from` переходит
 * через Новый год, обе границы включены.
 */
export function questThemeActiveCore(
    theme: { season?: string | null; preview?: QuestThemePreviewWindow | null },
    today: SeasonalMonthDay,
    calendarSeason: string | null,
    siteSeason: string | null,
): boolean {
    if (!theme.season) return true;
    if (theme.season === calendarSeason || theme.season === siteSeason) return true;
    var preview = theme.preview;
    if (!preview) return false;
    var point = today.month * 100 + today.day;
    var from = preview.from.month * 100 + preview.from.day;
    var to = preview.to.month * 100 + preview.to.day;
    return from <= to ? point >= from && point <= to : point >= from || point <= to;
}

/**
 * Вечная тема активна всегда; сезонная — в окне одноимённого сезона оформления
 * (локальная дата клиента), в окне раннего показа (`previewFrom`) и в любой
 * день, когда этот сезон выбран оформлением сайта (`siteSeason` —
 * `useTheme().activeSeasonalTheme`). Сезон без записи в `SEASONAL_THEMES`
 * считается неактивным: подборка молча не появится, а не покажется круглый год.
 */
export function isQuestThemeActive(
    theme: Pick<QuestThemeDefinition, 'season' | 'previewFrom'>,
    now: Date = new Date(),
    siteSeason: SeasonalThemeId | null = null,
): boolean {
    if (!theme.season) return true;
    return questThemeActiveCore(
        { season: theme.season, preview: getQuestThemePreviewWindow(theme) },
        { month: now.getMonth() + 1, day: now.getDate() },
        getSeasonalThemeByCalendar(now),
        siteSeason,
    );
}
