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
const listeners = new Set<(position: LiveUserPosition | null) => void>()

/** Публикует свежий фикс подписчикам. Не вызывает ни одного React-рендера. */
export function publishLiveUserPosition(position: LiveUserPosition | null): void {
  currentPosition = position
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
  listeners.clear()
}
