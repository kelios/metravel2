import { focusManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import type { AppStateStatus } from 'react-native';

let configured = false;

/**
 * LC-1: подключает `focusManager` React Query к `AppState` на Android/iOS ровно
 * один раз. Без этого «фокус» на native никогда не менялся, и
 * `refetchOnWindowFocus` был мёртвой настройкой: приложение, вернувшееся на
 * передний план через несколько часов, показывало устаревшие списки.
 *
 * Web не трогаем: там `focusManager` сам слушает `visibilitychange`, а
 * refetch по фокусу остаётся выключенным (`utils/reactQueryConfig.ts`).
 *
 * Подписка на `AppState` создаётся при установке слушателя и снимается, когда
 * у `focusManager` не остаётся подписчиков (так устроен `setEventListener`).
 */
export function setupQueryFocusManager(): void {
  if (configured || Platform.OS === 'web') return;
  configured = true;

  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      handleFocus(status === 'active');
    });
    return () => {
      subscription.remove();
    };
  });
}

/** Только для тестов: позволяет повторно подключить слушатель в новом окружении. */
export function __resetQueryFocusManagerForTests(): void {
  configured = false;
}
