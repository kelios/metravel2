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
 * Наименьший пресет шире текущего радиуса, в том числе для нестандартного
 * значения из ссылки. Если более широкого пресета нет, возвращает null.
 */
export function getNextRadiusOption(
  radiusOptions: ReadonlyArray<MapRadiusOption> | undefined | null,
  currentRadius: string | number | undefined | null,
): MapRadiusOption | null {
  const options = Array.isArray(radiusOptions) ? radiusOptions : []
  if (options.length === 0) return null

  const current = Number(currentRadius)
  if (!Number.isFinite(current) || current <= 0) return options[0] ?? null

  let next: MapRadiusOption | null = null
  for (const option of options) {
    const radius = Number(option.id)
    if (Number.isFinite(radius) && radius > current && (!next || radius < Number(next.id))) {
      next = option
    }
  }
  return next
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
