/**
 * Канал живой позиции пользователя — вне React.
 *
 * Тик GPS во время движения приходит примерно раз в секунду. Если каждый такой
 * тик становится React-состоянием, перерисовывается весь экран карты: карточки
 * списка «рядом», чипы расстояний, радиус-круг. Пользователь за рулём видит это
 * как «экран постоянно перерисовывается».
 *
 * Поэтому живая позиция живёт здесь, а не в состоянии:
 *  - маркер «вы здесь» двигается императивно (`setLatLng` / инъекция в WebView);
 *  - действия («маршрут от меня») читают точку в момент вызова через
 *    `getLiveUserPosition()`;
 *  - React-состояние `useMapCoordinates` обновляется только на первом фиксе и по
 *    явному запросу пользователя.
 */
export type LiveUserPosition = {
  latitude: number
  longitude: number
  /** Момент фикса (epoch ms) — по нему считается «давно не обновлялось». */
  timestamp: number
}

let currentPosition: LiveUserPosition | null = null
let lastFixReceivedAt = 0
const listeners = new Set<(position: LiveUserPosition | null) => void>()

/**
 * Отмечает, что от геослужбы пришёл очередной фикс — независимо от того, сдвинулся
 * ли пользователь настолько, чтобы его публиковать.
 *
 * Зачем отдельно от `publishLiveUserPosition`: публикация намеренно пропускает
 * тики ближе `LIVE_LOCATION_MIN_DISTANCE_M`, поэтому у неподвижного пользователя
 * последняя опубликованная точка не обновляется НИКОГДА. Если мерить свежесть по
 * ней, «Местоположение давно не обновлялось» загорается у любого, кто просто стоит
 * на месте. Свежесть — это «когда мы в последний раз получили ответ от геослужбы»,
 * и считать её нужно по времени приёма, а не по времени фикса из ОС: первый тик
 * Android нередко отдаёт из кэша со старым timestamp.
 */
export function markLiveUserPositionFix(receivedAt: number = Date.now()): void {
  lastFixReceivedAt = receivedAt
}

/** Момент приёма последнего фикса (epoch ms) или 0, если фиксов не было. */
export function getLiveUserPositionFixAt(): number {
  return lastFixReceivedAt
}

/** Публикует свежий фикс подписчикам. Не вызывает ни одного React-рендера. */
export function publishLiveUserPosition(position: LiveUserPosition | null): void {
  currentPosition = position
  // Доступ к позиции потеряли — свежести больше нет, счётчик обнуляем.
  if (position === null) lastFixReceivedAt = 0
  listeners.forEach((listener) => {
    try {
      listener(position)
    } catch {
      // подписчик не должен ронять публикацию для остальных
    }
  })
}

/** Самая свежая известная позиция (или null, если её нет/потеряли доступ). */
export function getLiveUserPosition(): LiveUserPosition | null {
  return currentPosition
}

export function subscribeLiveUserPosition(
  listener: (position: LiveUserPosition | null) => void,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Только для тестов: сброс модульного состояния между кейсами. */
export function resetLiveUserPosition(): void {
  currentPosition = null
  lastFixReceivedAt = 0
  listeners.clear()
}
