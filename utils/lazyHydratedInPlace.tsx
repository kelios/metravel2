/**
 * Отложенный экран, который гидрируется на месте (#3370).
 *
 * `React.lazy` на первом рендере всегда бросает промис — даже когда чанк экрана уже исполнен. Граница
 * `Suspense` остаётся негидрированной, и первое же обновление сверху заставляет React отказаться от
 * серверной разметки: статика → запасной вид → экран, а поле, в которое уже печатали, заменяется вместе
 * с фокусом и набранными символами.
 *
 * Загрузчик Expo на web отдаёт у `import()` поле `_result`: сам модуль, если все файлы чанка уже
 * исполнены (их теги `<script>` стоят в HTML роута раньше входного файла —
 * `ROUTE_EAGER_LAZY_SCREENS` в `scripts/lib/granularChunkMerge.js`), иначе промис. Тем же полем
 * expo-router синхронно поднимает модули роутов. Здесь готовый модуль рисуется сразу, без `React.lazy`:
 * гидрация границы проходит с первой попытки. Чанк не готов (переход внутри приложения, сборка без
 * доставки чанка в HTML) — прежний `React.lazy`, выбор делается один раз и не меняется.
 */

import React, { type ComponentType, type LazyExoticComponent } from 'react'

type ScreenModule<P> = { default: ComponentType<P> }

/** `import()` экрана: у загрузчика Expo промис несёт `_result` — модуль или тот же промис. */
export type MaybeReadyImport<P> = PromiseLike<ScreenModule<P>> & {
  _result?: ScreenModule<P> | PromiseLike<ScreenModule<P>> | null
}

const isReadyModule = <P,>(value: unknown): value is ScreenModule<P> =>
  value != null &&
  typeof value === 'object' &&
  typeof (value as PromiseLike<unknown>).then !== 'function' &&
  (value as ScreenModule<P>).default != null

/**
 * @param load вызов `import()` экрана — в том же выражении, что и флаг фичи (#2738)
 * @param onFirstRender один раз перед первым рендером экрана, в render-фазе: при гидрации серверная
 *   разметка в этот момент ещё цела (в обоих исходах — на месте и с заменой)
 */
export function lazyHydratedInPlace<P extends object>(load: () => MaybeReadyImport<P>, onFirstRender?: () => void): ComponentType<P> {
  let Ready: ComponentType<P> | null = null
  let Deferred: LazyExoticComponent<ComponentType<P>> | null = null

  const pick = (): ComponentType<P> => {
    if (Ready) return Ready
    if (Deferred) return Deferred as unknown as ComponentType<P>
    onFirstRender?.()
    const pending = load()
    const result = pending._result
    if (isReadyModule<P>(result)) {
      Ready = result.default
      return Ready
    }
    Deferred = React.lazy(() => Promise.resolve(pending))
    return Deferred as unknown as ComponentType<P>
  }

  function ScreenHydratedInPlace(props: P) {
    const Screen = pick()
    return <Screen {...props} />
  }
  return ScreenHydratedInPlace
}
