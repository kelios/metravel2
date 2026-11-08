import React, { startTransition, useEffect, useRef, useState } from 'react'
import { IsRestoringProvider, QueryClientProvider } from '@tanstack/react-query'
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
  type PersistQueryClientProviderProps,
} from '@tanstack/react-query-persist-client'
import type { SecondaryQueryPersistence } from '@/utils/userPointsPersist'

/**
 * `PersistQueryClientProvider` (@tanstack/react-query-persist-client 5.101.2) с
 * одной разницей: конец восстановления (`isRestoring → false`) публикуется в
 * `startTransition`.
 *
 * #2899: библиотечный провайдер снимает флаг обычным `setState` прямо после
 * гидратации оболочки. Обновление контекста над ещё не гидратированными
 * Suspense-границами поднимает гидратацию всего дерева до sync-лейна — одна
 * длинная задача на mobile. В transition React гидратирует нарезкой.
 * Остальной контракт (restore один раз, subscribe после restore) — как у
 * библиотеки; при обновлении пакета сверить с её исходником.
 *
 * `secondaryPersistence` (#3130): персисты с собственным ключом storage
 * (коллекция «Моих точек»). Восстанавливаются вместе с основным до снятия
 * `isRestoring`, подписываются после него; сбой одного не роняет остальные.
 */
export function TransitionPersistQueryClientProvider({
  children,
  persistOptions,
  secondaryPersistence,
  onSuccess,
  onError,
  ...props
}: PersistQueryClientProviderProps & { secondaryPersistence?: readonly SecondaryQueryPersistence[] }) {
  const [isRestoring, setIsRestoring] = useState(true)
  const refs = useRef({ persistOptions, secondaryPersistence, onSuccess, onError })
  const didRestore = useRef(false)

  useEffect(() => {
    refs.current = { persistOptions, secondaryPersistence, onSuccess, onError }
  })

  useEffect(() => {
    const options = { ...refs.current.persistOptions, queryClient: props.client }
    const secondary = refs.current.secondaryPersistence ?? []
    if (!didRestore.current) {
      didRestore.current = true
      Promise.all([
        persistQueryClientRestore(options),
        ...secondary.map((p) => p.restore(props.client).catch(() => undefined)),
      ])
        .then(() => refs.current.onSuccess?.())
        .catch(() => refs.current.onError?.())
        .finally(() => {
          startTransition(() => setIsRestoring(false))
        })
    }
    if (isRestoring) return undefined
    const unsubscribers = [
      persistQueryClientSubscribe(options),
      ...secondary.map((p) => p.subscribe(props.client)),
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [props.client, isRestoring])

  return (
    <QueryClientProvider {...props}>
      <IsRestoringProvider value={isRestoring}>{children}</IsRestoringProvider>
    </QueryClientProvider>
  )
}
