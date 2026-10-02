export type ToastPayload = {
  text1?: string;
  text2?: string;
  type?: string;
  visibilityTime?: number;
  position?: 'top' | 'bottom';
  /** Кнопка в тосте («Отменить»): рисуется ToastHost.web, нажатие скрывает тост. */
  action?: ToastAction;
};

export type ToastAction = { label: string; onPress: () => void };

export const WEB_TOAST_EVENT_NAME = 'metravel:toast';

export async function showToast(payload: ToastPayload): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(WEB_TOAST_EVENT_NAME, { detail: payload }));
  } catch {
    // ignore
  }
}

export const showToastMessage = showToast

// No-op on web: web toasts are positioned by the web toast host, not the
// native BottomDock. Kept for API parity with the native module.
export function setToastDockInset(_height: number): void {}
