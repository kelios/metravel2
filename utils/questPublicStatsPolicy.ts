/**
 * Пороги показа публичной статистики квестов (#2906).
 *
 * Шапка /quests показывает «N прохождений · M игроков» с первого прохождения и
 * первого игрока: счётчик — живое доказательство, что квесты проходят. Масштаб
 * каталога (квесты · города · страны) — запасной вариант, пока прохождений нет.
 * «Пройдено 1 раз» на карточке уступает место приглашению «Будьте первым».
 * Все пороги — здесь, в одном месте.
 */
import { buildQuestCityLandingGroups } from '@/utils/questCityAlias'

export const QUEST_PUBLIC_STATS_THRESHOLDS = {
  /** Прохождения по всему каталогу: ниже — счётчик прохождений не показывается. */
  catalogCompletions: 1,
  /** Разные игроки (`GET /api/quests/stats/`): ниже — число игроков не показывается. */
  catalogPlayers: 1,
  /** Прохождения одного квеста: ниже — «Будьте первым» вместо «Пройдено N раз». */
  questCompletions: 2,
} as const

export function isCatalogCompletionsPublic(total: number): boolean {
  return Number.isFinite(total) && total >= QUEST_PUBLIC_STATS_THRESHOLDS.catalogCompletions
}

export function isCatalogPlayersPublic(players: number | null | undefined): boolean {
  return typeof players === 'number' && Number.isFinite(players) && players >= QUEST_PUBLIC_STATS_THRESHOLDS.catalogPlayers
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
