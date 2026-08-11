import { Platform } from 'react-native'

/**
 * Хэндофф «SSG-шелл → React». Шелл `#ssg-skeleton` — fixed-оверлей поверх
 * приложения, и снимался он по классу `app-hydrated`, который ставит ЛЕНИВЫЙ
 * чанк RootWebDeferredChrome. Замер прода 2026-08-11 (`/`, mobile 390, CPU 4×,
 * 1,6 Мбит/150 мс): реальный hero был в #root на 4977 мс, `app-hydrated` — на
 * 6530 мс, то есть 1,55 с пользователь смотрел на скелетон поверх готовой
 * интерактивной страницы.
 *
 * Экран сам сообщает о своём первом кадре: `#root[data-first-screen-ready]`.
 * Атрибут читает `screenReady()` в removal-скрипте (scripts/ssg-skeletons.js) —
 * он же слушает его через MutationObserver, поэтому шелл снимается в том же
 * кадре, без ожидания 120-мс поллинга.
 *
 * Двойной requestAnimationFrame обязателен: сигнал должен уйти после того, как
 * кадр с контентом реально отрисован, иначе оверлей снимется на кадр раньше и
 * пользователь увидит пустую страницу.
 *
 * ГРАНИЦА КОНТРАКТА. Утилита гарантирует только «прошло два кадра после того,
 * как вызвавший её компонент смонтирован» — за то, что в этот момент на экране
 * действительно есть контент, отвечает вызывающий маршрут. Для главной это так
 * по построению: первый же commit `Home` содержит статический `HomeHero`.
 * Маршруту, чей первый экран ждёт данных, этого мало — ср. `/search` (#1406),
 * где карточки приходят на секунду позже гидрации; там нужен предикат
 * готовности, как `skeletonPhase` у travel (TravelDetailsCriticalShell) или
 * загруженный тайл у карты.
 */
export const SSG_FIRST_SCREEN_READY_ATTR = 'data-first-screen-ready'

export function markSsgFirstScreenReady(): () => void {
  // Платформа проверяется в момент вызова, а не на импорте: модуль вызывается
  // ровно один раз за монтирование экрана, зато так его можно проверить тестом.
  if (Platform.OS !== 'web' || typeof document === 'undefined') return () => {}

  const root = document.getElementById('root')
  if (!root) return () => {}

  let outerRaf: number | null = null
  let innerRaf: number | null = null
  // Флаг, а не только cancelAnimationFrame: экран мог размонтироваться между
  // кадрами, и уже запланированный колбэк не должен снять чужой шелл.
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
