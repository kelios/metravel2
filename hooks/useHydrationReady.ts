import { Platform } from 'react-native'
import { useEffect, useState } from 'react'

export type HydrationReadyOptions = {
  /**
   * `true` — консьюмер монтируется уже ПОСЛЕ гидратации, то есть его разметки
   * нет в статическом HTML и mismatch невозможен. Тогда ждать собственный
   * commit незачем: лишний «нулевой» кадр рисует мобильную/узкую раскладку, а
   * следующий кадр перекладывает её под реальную ширину — это чистый CLS
   * (#1282: 0,2374 из 0,2431 на desktop главной одним кадром).
   *
   * Ставить только там, где родитель гарантированно монтирует поддерево после
   * гидратации (например `Home` — `app/(tabs)/index.tsx` рендерит его лишь при
   * `hydrated === true`). Для узла, который есть в SSR HTML, это hydration
   * mismatch (#418).
   */
  clientOnly?: boolean
}

/**
 * Returns false for SSR and the first web hydration render, then switches to
 * true immediately after this consumer commits. Native renders are always ready.
 * `clientOnly` consumers skip that wait — see {@link HydrationReadyOptions}.
 */
export function useHydrationReady({ clientOnly = false }: HydrationReadyOptions = {}): boolean {
  const [hydrationReady, setHydrationReady] = useState(Platform.OS !== 'web' || clientOnly)

  useEffect(() => {
    if (hydrationReady) return
    setHydrationReady(true)
  }, [hydrationReady])

  return hydrationReady
}

/**
 * Хэндофф «SSG-шелл → React». Шелл `#ssg-skeleton` — fixed-оверлей поверх
 * приложения. Экран сообщает о своём первом кадре атрибутом
 * `#root[data-first-screen-ready]`, который читает `screenReady()` в
 * `scripts/ssg-skeletons.js`.
 *
 * Двойной requestAnimationFrame обязателен: сигнал должен уйти после того, как
 * кадр с контентом реально отрисован, иначе оверлей снимется на кадр раньше и
 * пользователь увидит пустую страницу.
 *
 * Граница контракта: helper гарантирует только два кадра после вызова. За то,
 * что на экране уже есть реальный контент, отвечает вызывающий маршрут. Для
 * экрана, который ждёт данные, вызов допустим только после терминального
 * состояния первого экрана: контент, честное пустое состояние или ошибка.
 */
export const SSG_FIRST_SCREEN_READY_ATTR = 'data-first-screen-ready'

export function markSsgFirstScreenReady(): () => void {
  // Платформа проверяется в момент вызова, чтобы контракт можно было проверить
  // тестом и безопасно импортировать в shared/native коде.
  if (Platform.OS !== 'web' || typeof document === 'undefined') return () => {}

  const root = document.getElementById('root')
  if (!root) return () => {}

  let outerRaf: number | null = null
  let innerRaf: number | null = null
  // Одной отмены RAF недостаточно: экран может размонтироваться между кадрами.
  let cancelled = false

  outerRaf = requestAnimationFrame(() => {
    outerRaf = null
    if (cancelled) return
    innerRaf = requestAnimationFrame(() => {
      innerRaf = null
      if (cancelled) return
      root.setAttribute(SSG_FIRST_SCREEN_READY_ATTR, 'true')
    })
  })

  return () => {
    cancelled = true
    if (outerRaf != null) cancelAnimationFrame(outerRaf)
    if (innerRaf != null) cancelAnimationFrame(innerRaf)
    root.removeAttribute(SSG_FIRST_SCREEN_READY_ATTR)
  }
}
