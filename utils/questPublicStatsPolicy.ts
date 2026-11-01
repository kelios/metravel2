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

/** «Пройдено N раз» и «Первым прошёл …» показываются от двух прохождений. */
export function isQuestCompletionsPublic(count: number | null | undefined): boolean {
  return typeof count === 'number' && Number.isFinite(count) && count >= QUEST_PUBLIC_STATS_THRESHOLDS.questCompletions
}

/** Масштаб каталога вместо счётчиков ниже порога: разных городов и стран. */
export function countQuestCatalogScale<T extends { cityId?: string | null; countryCode?: string | null }>(
  quests: readonly T[],
): { cities: number; countries: number } {
  const cities = new Set<string>()
  const countries = new Set<string>()
  for (const quest of quests) {
    const city = String(quest.cityId ?? '').trim().toLowerCase()
    if (city) cities.add(city)
    const country = String(quest.countryCode ?? '').trim().toUpperCase()
    if (country) countries.add(country)
  }
  return { cities: cities.size, countries: countries.size }
}
