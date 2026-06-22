// Dev-only QA observability. No-op в production (__DEV__ === false).
// Логирует ключевое runtime-состояние в ReactNativeJS (тег [QA-STATE]) при каждой
// смене роута, чтобы device-QA читал состояние приложения из `adb logcat` БЕЗ правок
// компонентов (раньше для этого приходилось вставлять временный console.log + reload).
// Также ставит globalThis.__QA__() для ручного дампа из dev-консоли.
import { useAuthStore } from '@/stores/authStore'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { useViewHistoryStore } from '@/stores/viewHistoryStore'

let currentRoute = ''

export function dumpQaState(route: string, reason: 'route' | 'manual' = 'route'): void {
  if (!__DEV__) return
  try {
    const auth = useAuthStore.getState()
    console.info(
      '[QA-STATE]',
      JSON.stringify({
        reason,
        route,
        isAuthenticated: auth.isAuthenticated,
        userId: auth.userId,
        favorites: useFavoritesStore.getState().favorites.length,
        history: useViewHistoryStore.getState().viewHistory.length,
        apiUrl: process.env.EXPO_PUBLIC_API_URL ?? null,
      }),
    )
  } catch {
    /* QA-диагностика не должна влиять на рантайм */
  }
}

// Вызывается из app/_layout на каждой смене роута (dev). Идемпотентно ставит __QA__().
export function installQaDebug(route: string): void {
  if (!__DEV__) return
  currentRoute = route
  const g = globalThis as { __QA__?: () => void }
  if (!g.__QA__) g.__QA__ = () => dumpQaState(currentRoute, 'manual')
  dumpQaState(route)
}
