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

  // Зависимости обязаны остаться пустыми. С `[hydrationReady]` эффект
  // переподписывается на переход false -> true, и React успевает перерисовать
  // поддерево до конца гидратации: SSR-разметка `/login` и `/registration`
  // (Google/Facebook-кнопки читают этот флаг) заменяется клиентской и даёт #418.
  // Проверено сборкой web-экспорта: с `[hydrationReady]` обе страницы падают,
  // с `[]` — чисто, а `clientOnly` продолжает работать через initial state.
  useEffect(() => {
    if (Platform.OS === 'web') {
      setHydrationReady(true)
    }
  }, [])

  return hydrationReady
}
