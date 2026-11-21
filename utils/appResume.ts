import { AppState, Platform } from 'react-native'

type AppResumeHandlers = {
  /** Вкладка снова видна (visibilitychange/focus/pageshow) или приложение стало `active`. */
  onResume: () => void
  /** Вкладка скрыта или приложение ушло из `active`. */
  onPause?: () => void
}

/**
 * Единая подписка «пользователь вернулся на вкладку / в приложение». Нужна тем,
 * кто показывает время: таймеры в фоне замораживаются, и без неё значение
 * догоняет часы только на следующем тике (#3467).
 */
export function subscribeAppResume({ onResume, onPause }: AppResumeHandlers): () => void {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onResume()
      else onPause?.()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onResume)
    window.addEventListener('pageshow', onResume)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('pageshow', onResume)
    }
  }
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') onResume()
    else onPause?.()
  })
  return () => subscription.remove()
}
