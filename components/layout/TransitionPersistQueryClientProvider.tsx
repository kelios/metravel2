import React, { startTransition, useEffect, useRef, useState } from 'react'
import { IsRestoringProvider, QueryClientProvider } from '@tanstack/react-query'
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
  type PersistQueryClientProviderProps,
} from '@tanstack/react-query-persist-client'

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
 */
export function TransitionPersistQueryClientProvider({
  children,
  persistOptions,
  onSuccess,
  onError,
  ...props
}: PersistQueryClientProviderProps) {
  const [isRestoring, setIsRestoring] = useState(true)
  const refs = useRef({ persistOptions, onSuccess, onError })
  const didRestore = useRef(false)

  useEffect(() => {
    refs.current = { persistOptions, onSuccess, onError }
  })

  useEffect(() => {
    const options = { ...refs.current.persistOptions, queryClient: props.client }
    if (!didRestore.current) {
      didRestore.current = true
      persistQueryClientRestore(options)
        .then(() => refs.current.onSuccess?.())
        .catch(() => refs.current.onError?.())
        .finally(() => {
          startTransition(() => setIsRestoring(false))
        })
    }
    return isRestoring ? undefined : persistQueryClientSubscribe(options)
  }, [props.client, isRestoring])

  return (
    <QueryClientProvider {...props}>
      <IsRestoringProvider value={isRestoring}>{children}</IsRestoringProvider>
    </QueryClientProvider>
  )
}
