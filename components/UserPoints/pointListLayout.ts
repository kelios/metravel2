import { METRICS } from '@/constants/layout'

/**
 * Список «Моих точек» на телефоне — компактные строки, а не карточки (#3142).
 * Одно правило для карточки точки и каркаса загрузки в сетке, чтобы каркас и
 * пришедшая запись не отличались геометрией (#2253). Ширина 0 — до гидратации
 * web: desktop-раскладка, как у родительского списка (#1814).
 */
export const isPhoneListWidth = (viewportWidth: number): boolean =>
  viewportWidth > 0 && viewportWidth < METRICS.breakpoints.tablet
