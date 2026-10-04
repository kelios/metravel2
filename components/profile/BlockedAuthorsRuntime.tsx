// #2134: guard блокировок для всего приложения.
//
// Компонент ничего не рисует, как QuestProgressQueueRuntime. Он ставит guard кэша
// (`installBlockedAuthorGuard`) на смонтированный QueryClient и у вошедшего
// пользователя загружает `myBlockedUsers` при старте сессии — поэтому контент
// заблокированных скрыт и после перезагрузки. Гостю запрос не уходит и набор
// пуст. Смена владельца сессии сбрасывает набор: ключ списка несёт владельца, а
// `dropQueryCacheForIdentityChange` сносит прежний.

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { installBlockedAuthorGuard } from '@/api/blockSensitiveQueries'
import { useBlockedUsers } from '@/hooks/useUserSafety'
import { useAuthStore } from '@/stores/authStore'

// То же выражение личности, что у `useQueryOwner` и сброса кэша (`stores/authStore.ts`).
const getSessionOwner = (): string | null => {
  const state = useAuthStore.getState()
  return state.isAuthenticated ? state.userId : null
}

export default function BlockedAuthorsRuntime() {
  const queryClient = useQueryClient()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  useEffect(() => installBlockedAuthorGuard(queryClient, { getOwner: getSessionOwner }), [queryClient])

  useBlockedUsers(isAuthenticated)
  return null
}
