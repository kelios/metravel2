/**
 * Пороги показа публичной статистики квестов (#2906).
 *
 * Счётчик «44 прохождения · 30 игроков» на /quests и «Пройдено 1 раз» на карточке
 * честны, но работают против доверия: маленькое число читается как «сюда никто не
 * ходит». Дизайн (#2761) предполагал растущие числа, поэтому ниже порога каталог
 * показывает масштаб (квесты · города · страны), а карточка — приглашение «Будьте
 * первым». Когда порог достигнут, прежний формат возвращается сам, без правки кода.
 * Все пороги — здесь, в одном месте.
 */
import { buildQuestCityLandingGroups } from '@/utils/questCityAlias'

export const QUEST_PUBLIC_STATS_THRESHOLDS = {
  /** Прохождения по всему каталогу: ниже — счётчик прохождений не показывается. */
  catalogCompletions: 100,
  /** Разные игроки (`GET /api/quests/stats/`): ниже — число игроков не показывается. */
  catalogPlayers: 50,
  /** Прохождения одного квеста: ниже — «Будьте первым» вместо «Пройдено N раз». */
  questCompletions: 2,
} as const

export function isCatalogCompletionsPublic(total: number): boolean {
  return Number.isFinite(total) && total >= QUEST_PUBLIC_STATS_THRESHOLDS.catalogCompletions
}

export function isCatalogPlayersPublic(players: number | null | undefined): boolean {
  return typeof players === 'number' && Number.isFinite(players) && players >= QUEST_PUBLIC_STATS_THRESHOLDS.catalogPlayers
}

/**
 * Статистика полного каталога публична, только когда оба порога достигнуты
 * сразу (#2906, #2914): иначе шапка показывает масштаб, а не одно из чисел.
 */
export function isCatalogStatsPublic(completions: number, players: number | null | undefined): boolean {
  return isCatalogCompletionsPublic(completions) && isCatalogPlayersPublic(players)
}

/** «Пройдено N раз» и «Первым прошёл …» показываются от двух прохождений. */
export function isQuestCompletionsPublic(count: number | null | undefined): boolean {
  return typeof count === 'number' && Number.isFinite(count) && count >= QUEST_PUBLIC_STATS_THRESHOLDS.questCompletions
}

/**
 * Масштаб каталога вместо счётчиков ниже порога: разных городов и стран. Города
 * считаются группами лендингов (`buildQuestCityLandingGroups`), а не по `cityId`:
 * город с двумя id (legacy) — один город, как и его страница `/quests/<город>` (#2914).
 */
export function countQuestCatalogScale<T extends { id: string; cityId?: string | null; countryCode?: string | null }>(
  quests: readonly T[],
): { cities: number; countries: number } {
  const countries = new Set<string>()
  for (const quest of quests) {
    const country = String(quest.countryCode ?? '').trim().toUpperCase()
    if (country) countries.add(country)
  }
  return { cities: buildQuestCityLandingGroups([...quests]).length, countries: countries.size }
}
