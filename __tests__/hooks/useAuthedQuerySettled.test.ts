import { renderHook } from '@testing-library/react-native'

import { useAuthedQuerySettled } from '@/hooks/useAuthedQuerySettled'
import { useAuthStore } from '@/stores/authStore'

// #2114: выключенный до авторизации запрос — это загрузка, а не «данных нет».
describe('useAuthedQuerySettled', () => {
  const setAuth = (authReady: boolean, isAuthenticated: boolean) =>
    useAuthStore.setState({ authReady, isAuthenticated } as never)

  it('авторизация ещё не готова — не устоялся, даже если запрос не «грузится»', () => {
    setAuth(false, false)
    expect(renderHook(() => useAuthedQuerySettled({ isPending: true })).result.current).toBe(false)
  })

  it('гость — устоялся (данных у гостя не будет)', () => {
    setAuth(true, false)
    expect(renderHook(() => useAuthedQuerySettled({ isPending: true })).result.current).toBe(true)
  })

  it('вошёл — ждёт ответа запроса', () => {
    setAuth(true, true)
    expect(renderHook(() => useAuthedQuerySettled({ isPending: true })).result.current).toBe(false)
    expect(renderHook(() => useAuthedQuerySettled({ isPending: false })).result.current).toBe(true)
  })
})
