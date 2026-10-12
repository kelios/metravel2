import { translate as i18nT } from '@/i18n';
import { getQuestThemeDefinitions, isQuestThemeActive, type QuestThemeDefinition } from './questThemeRegistry';
import { normalizeQuestTag } from '@/utils/questAudience';
import type { SeasonalThemeId } from '@/constants/seasonalThemes';

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
export type { QuestThemeId } from './questThemeRegistry';
export type QuestTheme = Omit<QuestThemeDefinition, 'labelKey'> & { readonly label: string };
const QUEST_THEMES: readonly QuestTheme[] = getQuestThemeDefinitions().map(({ labelKey, ...definition }) => ({
    ...definition,
    get label() { return i18nT(labelKey); },
}));
export function getQuestThemes(): readonly QuestTheme[] { return QUEST_THEMES; }
export function getQuestThemeById(id: string | null | undefined): QuestTheme | null {
    return QUEST_THEMES.find((theme) => theme.id === id) ?? null;
}
export { isQuestThemeActive } from './questThemeRegistry';

/** `siteSeason` — сезон оформления сайта (`useTheme().activeSeasonalTheme`), см. `isQuestThemeActive`. */
export function getActiveQuestThemes(now: Date = new Date(), siteSeason: SeasonalThemeId | null = null): QuestTheme[] {
    return QUEST_THEMES.filter((theme) => isQuestThemeActive(theme, now, siteSeason));
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
    siteSeason: SeasonalThemeId | null = null,
): QuestTheme | null {
    if (!tags?.length) return null;
    return getActiveQuestThemes(now, siteSeason).find((theme) => isQuestInTheme(theme, tags)) ?? null;
}
