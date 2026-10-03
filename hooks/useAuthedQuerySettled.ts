import { useAuthStore } from '@/stores/authStore'

/**
 * Устоялся ли запрос, который включается только для вошедшего (`enabled: isAuthenticated`).
 *
 * Выключенный запрос в React Query не «грузится» (`isLoading = false`), но и данных у него
 * нет. Пока авторизация поднимается (`authReady = false`), такой экран рисовал ложную
 * пустую заглушку («Вы ещё не организовали поездок») и блоки под ней, а через долю
 * секунды — скелетон и реальный список: вспышка и сдвиг (#2114). Здесь «нет данных»
 * отличается от «пусто»:
 *  - авторизация ещё не готова — не устоялся;
 *  - гость — устоялся (данных у гостя не будет);
 *  - вошёл — устоялся, когда у запроса есть ответ или ошибка (`!isPending`).
 */
export function useAuthedQuerySettled(query: { isPending: boolean }): boolean {
  const authReady = useAuthStore((s) => s.authReady)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!authReady) return false
  if (!isAuthenticated) return true
  return !query.isPending
}
