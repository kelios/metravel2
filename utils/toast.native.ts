import Toast from 'react-native-toast-message';

export type ToastPayload = {
  text1?: string;
  text2?: string;
  type?: string;
  visibilityTime?: number;
  position?: 'top' | 'bottom';
  bottomOffset?: number;
  /** Кнопка в тосте («Отменить»): рисуется ToastHost, нажатие скрывает тост. */
  action?: ToastAction;
};

export type ToastAction = { label: string; onPress: () => void };

/**
 * Зазор между тостом и верхом дока (#2161). Сам отступ тостов задаёт ToastHost
 * из общего резерва дока (`useDockReservePx`, #2097): высота дока уже включает
 * нижнюю safe-area, поэтому второго канала «высота дока для тостов» нет.
 */
export const TOAST_DOCK_GAP = 12;

/** Нижний отступ тоста: над доком, а без дока — над home indicator. */
export function toastBottomOffset(dockReservePx: number, safeAreaBottom: number): number {
  const base = dockReservePx > 0 ? dockReservePx : Math.max(0, safeAreaBottom || 0);
  return base + TOAST_DOCK_GAP;
}

/**
 * Тост уходит в тот же модуль, который рисует ToastHost, — статическим импортом
 * и в том же тике (#2168). Ленивый `import()` в dev-клиенте с lazy-бандлом
 * докачивал отдельный чанк на ~600 модулей при первом тосте: 2,3 с на спокойном
 * эмуляторе и десятки секунд под нагрузкой, а `catch {}` глушил сбой — device-QA
 * видела «тост не появился». В release-бандле чанков нет, ToastHost и так грузит
 * библиотеку статически, поэтому выигрыша ленивость не давала.
 */
export async function showToast(payload: ToastPayload): Promise<void> {
  const { action, ...rest } = payload;
  Toast.show({
    ...rest,
    ...(action ? { props: { action } } : {}),
  });
}

export const showToastMessage = showToast
