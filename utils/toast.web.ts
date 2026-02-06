type ToastPayload = {
  text1?: string;
  text2?: string;
  type?: string;
  visibilityTime?: number;
  position?: 'top' | 'bottom';
};

export const WEB_TOAST_EVENT_NAME = 'metravel:toast';

export async function showToast(payload: ToastPayload): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(WEB_TOAST_EVENT_NAME, { detail: payload }));
  } catch {
    // ignore
  }
}
