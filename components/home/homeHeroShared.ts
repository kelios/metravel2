export type QuickFilterValue =
  | string
  | number
  | Array<string | number>
  | ReadonlyArray<string | number>

export type QuickFilterParams = Record<string, QuickFilterValue | undefined>

/**
 * #1541: hero-набор рисуется в ОДНОМ кадре с кросс-фейдом, поэтому пропорция
 * кадра — константа набора, а не функция конкретной обложки: слот-от-контента
 * (приём #1487) дёргал бы геометрию hero на каждом автопереключении. Владелец
 * 2026-08-23 выбрал ландшафт 3:2 — под него нормализован и сам набор.
 */
export const HOME_HERO_MEDIA_SLOT_RATIO = 3 / 2

/**
 * Потолок доли плоского поля с одной стороны под `contain`
 * (`docs/RULES.md` → «Images and placeholders»). Слайд с пропорцией, дающей
 * больше, в набор не допускается — это и проверяет regression-тест #1541.
 */
export const HOME_HERO_MAX_FLAT_SHARE = 0.1
