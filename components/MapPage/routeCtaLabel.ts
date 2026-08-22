// components/MapPage/routeCtaLabel.ts
// Подпись главной кнопки построения маршрута.
//
// #1491: раньше эта лесенка состояний жила только в `useFiltersPanelModel` и
// существовала ровно на одном экране — /map. Планировщик поездки решает ту же
// задачу, поэтому логика вынесена сюда, а не скопирована: одинаковые слова и
// одинаковый порядок состояний на обеих поверхностях гарантированы кодом, а не
// договорённостью.
import { translate as i18nT } from '@/i18n'

/**
 * `pending`  — запрос уже летит, кнопка занята;
 * `rebuild`  — маршрут есть, действие пересчитает его;
 * `build`    — точек хватает, маршрута ещё нет;
 * `incomplete` — точек меньше двух, строить нечего.
 */
export type RouteCtaState = 'pending' | 'rebuild' | 'build' | 'incomplete'

export interface RouteCtaInput {
  /** Построение/сохранение уже идёт. */
  pending?: boolean
  /** Маршрут уже построен: у /map это `routeDistance != null`. */
  hasRoute?: boolean
  /** Точек достаточно, чтобы строить (старт + финиш). */
  canBuild?: boolean
}

export const routeCtaState = ({
  pending = false,
  hasRoute = false,
  canBuild = false,
}: RouteCtaInput): RouteCtaState => {
  if (pending) return 'pending'
  if (hasRoute) return 'rebuild'
  return canBuild ? 'build' : 'incomplete'
}

export const routeCtaLabel = (state: RouteCtaState): string => {
  switch (state) {
    case 'pending':
      return i18nT('map:components.MapPage.useFiltersPanelModel.stroim_a4e64969')
    case 'rebuild':
      return i18nT('map:components.MapPage.useFiltersPanelModel.pereschitat_marshrut_db9ce079')
    case 'build':
      return i18nT('map:components.MapPage.useFiltersPanelModel.postroit_marshrut_ca986f13')
    case 'incomplete':
      return i18nT('map:components.MapPage.useFiltersPanelModel.dobavte_start_i_finish_17e117d1')
  }
}
