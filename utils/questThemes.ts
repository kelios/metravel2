import { translate as i18nT } from '@/i18n';
import type { NavigationIconName } from '@/constants/navigationIcons';
import { SEASONAL_THEMES, isMonthDayInWindow, type SeasonalThemeId } from '@/constants/seasonalThemes';
import { normalizeQuestTag } from '@/utils/questAudience';

/**
 * Тематические подборки квестов (#2377).
 *
 * Тема — именованная коллекция поверх `meta.tags`: квест попадает в тему, если
 * несёт хотя бы один из её тегов. Сезон — свойство ТЕМЫ, а не квеста: квест
 * остаётся вечным (`minsk-ghosts-…`), а тег `halloween` лишь включает его в
 * сезонную подборку, которую каталог показывает в своём окне дат. Так один
 * квест живёт в двух подборках («Хэллоуин» в октябре, «Легенды и призраки»
 * круглый год), и ни одна дата не зашита в данные квеста.
 *
 * Реестр — единственный источник тем для сайдбара, мобильных чипов, заголовка
 * среза и бейджа карточки; SSG-лендинг темы (отдельная карточка) читает его же.
 * Бэкенд не знает о темах: теги приходят в каждом элементе `/api/quests/`.
 */
export type QuestThemeId = 'halloween' | 'christmas' | 'legends' | 'detective' | 'fairytale';

export type QuestTheme = {
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
    readonly label: string;
};

// Порядок реестра = порядок показа: сезонные темы впереди вечных, чтобы в свой
// сезон подборка стояла первой и в сайдбаре, и среди чипов, и в выборе бейджа.
const QUEST_THEMES: readonly QuestTheme[] = [
    {
        id: 'halloween',
        tags: ['halloween'],
        icon: 'moon',
        season: 'halloween',
        get label() { return i18nT('quests:utils.questThemes.halloween'); },
    },
    {
        id: 'christmas',
        tags: ['christmas'],
        icon: 'gift',
        season: 'christmas',
        get label() { return i18nT('quests:utils.questThemes.christmas'); },
    },
    {
        id: 'legends',
        tags: ['mystic', 'myth', 'mystery', 'ghost'],
        icon: 'feather',
        get label() { return i18nT('quests:utils.questThemes.legends'); },
    },
    {
        id: 'detective',
        tags: ['detective'],
        icon: 'search',
        get label() { return i18nT('quests:utils.questThemes.detective'); },
    },
    {
        id: 'fairytale',
        tags: ['fairytale'],
        icon: 'book-open',
        get label() { return i18nT('quests:utils.questThemes.fairytale'); },
    },
];

export function getQuestThemes(): readonly QuestTheme[] {
    return QUEST_THEMES;
}

export function getQuestThemeById(id: string | null | undefined): QuestTheme | null {
    if (!id) return null;
    return QUEST_THEMES.find((theme) => theme.id === id) ?? null;
}

/**
 * Вечная тема активна всегда; сезонная — только в окне одноимённого сезона
 * оформления (локальная дата клиента). Сезон без записи в `SEASONAL_THEMES`
 * считается неактивным: подборка молча не появится, а не покажется круглый год.
 */
export function isQuestThemeActive(theme: QuestTheme, now: Date = new Date()): boolean {
    if (!theme.season) return true;
    const window = SEASONAL_THEMES.find((seasonal) => seasonal.id === theme.season)?.window;
    if (!window) return false;
    return isMonthDayInWindow({ month: now.getMonth() + 1, day: now.getDate() }, window);
}

export function getActiveQuestThemes(now: Date = new Date()): QuestTheme[] {
    return QUEST_THEMES.filter((theme) => isQuestThemeActive(theme, now));
}

export function isQuestInTheme(theme: QuestTheme, tags?: readonly string[] | null): boolean {
    if (!tags?.length) return false;
    const normalized = new Set(tags.map(normalizeQuestTag).filter(Boolean));
    return theme.tags.some((tag) => normalized.has(tag));
}

export function filterQuestsByTheme<T extends { tags?: string[] | null }>(
    quests: readonly T[],
    theme: QuestTheme,
): T[] {
    return quests.filter((quest) => isQuestInTheme(theme, quest.tags));
}

/**
 * Тема для бейджа карточки: первая АКТИВНАЯ тема реестра, в которую входит
 * квест. Сезонная тема стоит в реестре раньше вечной, поэтому в октябре квест
 * с тегами `halloween`+`mystic` подписан «Хэллоуин», в остальное время —
 * «Легенды и призраки». Одна подпись: карточка и так несёт стек бейджей.
 */
export function getPrimaryQuestTheme(
    tags?: readonly string[] | null,
    now: Date = new Date(),
): QuestTheme | null {
    if (!tags?.length) return null;
    return getActiveQuestThemes(now).find((theme) => isQuestInTheme(theme, tags)) ?? null;
}
