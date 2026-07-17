/**
 * mapEmptyState — единый источник логики «в этой области ничего не нашлось».
 *
 * До этого расчёт «следующего пресета радиуса» жил только внутри
 * FiltersPanelBody, а сам empty-state показывался ТОЛЬКО в открытой панели
 * фильтров. Сценарий «Искать в этой области» происходит при ЗАКРЫТОЙ панели, и
 * пользователь при total=0 не видел ничего: маркеры исчезали, счётчик пропадал,
 * сообщения не было. Плашка на самой карте (MapEmptyStateToast) переиспользует
 * ЭТИ же функции, чтобы поведение «Увеличить радиус» / «Сбросить» совпадало с
 * панелью, а не разъезжалось второй копией логики.
 */

export type MapRadiusOption = { id: string; name: string }

/**
 * Следующий (более широкий) пресет радиуса относительно текущего значения.
 * Возвращает null, когда текущий радиус уже последний в списке.
 * Если текущее значение не найдено среди опций — предлагаем первую опцию.
 */
export function getNextRadiusOption(
  radiusOptions: ReadonlyArray<MapRadiusOption> | undefined | null,
  currentRadius: string | number | undefined | null,
): MapRadiusOption | null {
  const options = Array.isArray(radiusOptions) ? radiusOptions : []
  if (options.length === 0) return null

  const index = options.findIndex((option) => String(option.id) === String(currentRadius))
  if (index < 0) return options[0] ?? null
  return options[index + 1] ?? null
}

/**
 * #211 — empty-state показываем ТОЛЬКО когда запрос завершён: иначе «Ничего не
 * нашлось» мигает во время рефетча/дебаунса (смена вкладок, режимов, первый
 * фетч). Общий гейт для панели фильтров и для плашки на карте.
 */
export function shouldShowMapEmptyState(params: {
  mode: 'radius' | 'route'
  totalPoints: number
  isBusy?: boolean
}): boolean {
  const { mode, totalPoints, isBusy } = params
  return mode === 'radius' && totalPoints === 0 && !isBusy
}
