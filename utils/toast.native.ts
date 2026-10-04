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

type NativeToastModule = {
  default?: {
    show?: (payload: Record<string, unknown>) => void;
  };
  show?: (payload: Record<string, unknown>) => void;
};

let toastModulePromise: Promise<NativeToastModule> | null = null;

export async function showToast(payload: ToastPayload): Promise<void> {
  try {
    if (!toastModulePromise) {
      toastModulePromise = Promise.resolve(import('react-native-toast-message')) as Promise<NativeToastModule>;
    }
    const mod = await toastModulePromise;
    const Toast = mod.default ?? mod;
    if (Toast && typeof Toast.show === 'function') {
      const { action, ...rest } = payload;
      Toast.show({
        ...rest,
        ...(action ? { props: { action } } : {}),
      });
    }
  } catch {
    // ignore
  }
}

export const showToastMessage = showToast
