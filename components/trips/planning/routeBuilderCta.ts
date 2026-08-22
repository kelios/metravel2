// components/trips/planning/routeBuilderCta.ts
// Главное действие панели маршрута планировщика (#1491).
//
// Лесенка подписей берётся с /map (`components/MapPage/routeCtaLabel.ts`), а не
// пишется заново: на обоих экранах пользователь делает одно и то же и должен
// видеть одни и те же слова в одном и том же порядке.
//
// Отличие планировщика ровно одно и оно продуктовое: кнопка существует только
// пока есть что сохранять. Постоянная кнопка «Сохранить маршрут» не отличала
// «правки ждут» от «всё уже на сервере», и нажать её можно было впустую.
import { translate as i18nT } from '@/i18n'
import {
  routeCtaLabel,
  routeCtaState,
  type RouteCtaState,
} from '@/components/MapPage/routeCtaLabel'

export interface RouteBuilderCtaInput {
  /** Точек в текущем (черновом) маршруте. */
  pointCount: number
  /** Точек в сохранённом маршруте: ≥2 значит маршрут уже построен на сервере. */
  savedPointCount: number
  /** Черновик отличается от сохранённого — есть что отправлять. */
  hasUnsavedChanges: boolean
  /** Выбранный оригинал ещё не загружен, даже если точки уже сохранены. */
  hasPendingOriginal?: boolean
  /** Сохранение или перестроение уже летит. */
  pending: boolean
}

export interface RouteBuilderCta {
  /** Показывать ли кнопку вообще. */
  visible: boolean
  disabled: boolean
  label: string
  /** Подсказка рядом с кнопкой, когда маршрут ещё не из чего строить. */
  hint: string | null
  state: RouteCtaState
}

/** Маршрут по дорогам требует минимум старт и финиш — тот же порог, что на /map. */
const MIN_ROUTE_POINTS = 2

export const routeBuilderCta = ({
  pointCount,
  savedPointCount,
  hasUnsavedChanges,
  hasPendingOriginal = false,
  pending,
}: RouteBuilderCtaInput): RouteBuilderCta => {
  const state = routeCtaState({
    pending,
    // «Пересчитать» — когда маршрут уже построен на сервере. Это же состояние
    // остаётся, если пользователь укоротил маршрут: правка реальная, и
    // сохранить её нужно уметь, иначе очистить маршрут в планировщике нечем.
    hasRoute: savedPointCount >= MIN_ROUTE_POINTS,
    canBuild: pointCount >= MIN_ROUTE_POINTS,
  })

  // Единственное расхождение с /map, и оно вынужденное: там кнопка строит
  // маршрут и без старта с финишем ей делать нечего, а здесь она сохраняет
  // список точек. Список из одной точки — законный промежуточный черновик,
  // запирать его нельзя, поэтому «Добавьте старт и финиш» на этой ступени
  // остаётся подсказкой, а кнопка честно называет своё действие.
  const incomplete = state === 'incomplete'
  const originalOnly = hasPendingOriginal && !hasUnsavedChanges

  return {
    visible: hasUnsavedChanges || hasPendingOriginal,
    disabled: pending,
    label: originalOnly || incomplete
      ? i18nT('trips:components.trips.planning.RouteBuilder.sohranit_marshrut_31633565')
      : routeCtaLabel(state),
    hint: incomplete && !originalOnly ? routeCtaLabel('incomplete') : null,
    state,
  }
}
