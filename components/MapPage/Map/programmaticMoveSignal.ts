/**
 * programmaticMoveSignal — module-level guard that marks a window during which the
 * map is moving because WE moved it (auto-fit / flyTo / setView / panBy), not the
 * user.
 *
 * Why: the radius-mode server-cluster viewport query (useMapViewportSnapshot →
 * useMapClusters) refetches on every `moveend`/`zoomend`. A programmatic
 * `fitBounds` fires those same events, which refetches clusters for the in-flight
 * viewport, which changes the rendered data, which could re-trigger another fit —
 * a zoom-in/zoom-out flicker loop on mobile. Callers wrap their programmatic map
 * motion with `beginProgrammaticMapMove()`, and useMapViewportSnapshot ignores the
 * self-induced events until the window elapses (then does ONE trailing read so the
 * clusters still match the settled viewport). Genuine user pans/zooms are never
 * suppressed because they don't open this window.
 */
let suppressUntil = 0
/**
 * Пользователь нажал «Приблизить» или «Отдалить». Пока флаг стоит,
 * авто-подгонка того же радиуса не переписывает этот зум. Сбрасывается
 * сменой радиуса и возвратом из маршрута в радиус.
 */
let userAdjustedView = false

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

/** Open (or extend) the self-induced-motion window. Default covers a 0.35s flyTo. */
export function beginProgrammaticMapMove(durationMs = 500): void {
  suppressUntil = Math.max(suppressUntil, now() + durationMs)
  notify()
}

/** Milliseconds left in the current self-induced-motion window (0 when inactive). */
export function programmaticMapMoveRemainingMs(): number {
  const remaining = suppressUntil - now()
  return remaining > 0 ? remaining : 0
}

export function isProgrammaticMapMoveActive(): boolean {
  return programmaticMapMoveRemainingMs() > 0
}

/** Зафиксировать, что вид карты выбрал пользователь, а не авто-фит. */
export function noteUserMapGesture(): void {
  userAdjustedView = true
}

export function hasUserAdjustedMapView(): boolean {
  return userAdjustedView
}

/** Разрешить следующую авто-подгонку после смены радиуса или возврата из маршрута. */
export function clearUserMapGesture(): void {
  userAdjustedView = false
}

// --- Подписка (#2450) ----------------------------------------------------------
// useMapClusters держит запрос кластеров, пока карту двигаем МЫ (авто-фит после
// смены радиуса, flyTo к месту): иначе первый запрос уходит со старым bbox и новым
// радиусом, а второй — после фита, и каждая смена радиуса стоит два запроса.

type Listener = () => void
const listeners = new Set<Listener>()

/** Уведомить подписчиков об открытии/продлении окна программного движения. */
function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // noop — подписчик не должен ронять сигнал
    }
  })
}

export function subscribeProgrammaticMapMove(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Только для тестов: сбросить окно и подписчиков. */
export function __resetProgrammaticMapMoveForTests(): void {
  suppressUntil = 0
  userAdjustedView = false
  listeners.clear()
}
