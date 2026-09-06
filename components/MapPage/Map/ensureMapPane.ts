/**
 * Единственное место, где веб-карта заводит собственный Leaflet-pane и задаёт
 * ему порядок отрисовки. До #1813 этот блок был скопирован трижды (маркер «вы
 * здесь» и два слоя маршрута), и каждая копия обязана была помнить все
 * особенности патча `utils/leafletFix`.
 *
 * Особенность 1 — `Map.prototype.getPane` пропатчен в GET-OR-CREATE.
 * Отсутствующий pane он создаёт сам и возвращает, но БЕЗ стилей. Поэтому
 * привычная схема «если pane ещё нет — создать и настроить» не работает: ветка
 * создания не выполняется никогда, а pane остаётся с дефолтным `z-index: 400`.
 * Ровно на этом в #1780 первая версия фикса молча не сработала. Отсюда правило:
 * стиль применяется КАЖДЫЙ раз, а не только при создании. `createPane` остаётся
 * фолбэком для ванильного Leaflet (jest/native), где патча нет.
 *
 * Особенность 2 — на мёртвой/пересоздаваемой карте тот же патч отдаёт
 * detached-заглушку (узел вне документа). Вешать на неё слой нельзя: он просто
 * исчезнет с карты. Такой pane отсекается по `isConnected === false`, стили на
 * него не применяются, и потребитель получает `undefined` — сигнал остаться в
 * штатном pane Leaflet.
 *
 * Особенность 3 — у СНЕСЁННОЙ карты `Map.remove()` обнуляет `_panes` и
 * `_mapPane` (leaflet-src.js: `this._panes = []; delete this._mapPane`), но
 * оставляет `_container`. На такой карте патч (`utils/leafletFix.ts:89-90`)
 * отдаёт уже не заглушку, а сам контейнер карты либо общий `mapPane` — узлы
 * ЖИВЫЕ, поэтому проверка `isConnected` их не ловит. Записать в них
 * `pointer-events: none` значит убить интерактивность всей карты, включая
 * новую, если react-leaflet переиспользует тот же контейнер при remount.
 * Поэтому свой pane никогда не совпадает с контейнером и с `mapPane`.
 *
 * @module components/MapPage/Map/ensureMapPane
 */

export interface EnsureMapPaneOptions {
  /** Порядок отрисовки pane. Число приводится к строке за вызывающего. */
  zIndex: number | string
  /** `'none'` для чисто визуального pane, который не должен красть тап. */
  pointerEvents?: string
}

/**
 * Берёт или создаёт pane карты и безусловно применяет к нему стили.
 *
 * @returns имя pane, пригодное для `<Layer pane=…>`, либо `undefined`, если
 * безопасного pane нет — тогда слой остаётся в штатном pane Leaflet.
 */
export function ensureMapPane(
  map: any,
  name: string,
  { zIndex, pointerEvents }: EnsureMapPaneOptions,
): string | undefined {
  if (!map || !name) return undefined

  try {
    const existing = typeof map.getPane === 'function' ? map.getPane(name) : null
    const pane = existing || (typeof map.createPane === 'function' ? map.createPane(name) : null)

    // Особенность 2: заглушка мёртвой карты — не pane.
    if (!pane || pane.isConnected === false || !pane.style) return undefined

    // Особенность 3: контейнер карты и общий mapPane — тоже не наш pane.
    const container = typeof map.getContainer === 'function' ? map.getContainer() : undefined
    if (pane === container || pane === map._mapPane) return undefined

    // Особенность 1: стиль применяем всегда, а не только при создании.
    pane.style.zIndex = String(zIndex)
    if (pointerEvents !== undefined) pane.style.pointerEvents = pointerEvents

    return name
  } catch {
    // Карта в переходном состоянии — потребитель работает без своего pane.
    return undefined
  }
}
