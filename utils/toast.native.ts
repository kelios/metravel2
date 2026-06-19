export type ToastPayload = {
  text1?: string;
  text2?: string;
  type?: string;
  visibilityTime?: number;
  position?: 'top' | 'bottom';
  bottomOffset?: number;
};

// The bottom tab bar (BottomDock) is pinned to the bottom (~56px + safe-area
// inset). The library's default bottomOffset of 40 places bottom toasts under
// the dock, hiding them. Lift bottom toasts above the dock by default.
const DEFAULT_BOTTOM_OFFSET = 100;

type NativeToastModule = {
  default?: {
    show?: (payload: ToastPayload) => void;
  };
  show?: (payload: ToastPayload) => void;
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
      const isBottom = (payload.position ?? 'bottom') === 'bottom';
      Toast.show(
        isBottom && payload.bottomOffset === undefined
          ? { ...payload, bottomOffset: DEFAULT_BOTTOM_OFFSET }
          : payload,
      );
    }
  } catch {
    // ignore
  }
}

export const showToastMessage = showToast
