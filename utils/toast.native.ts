export type ToastPayload = {
  text1?: string;
  text2?: string;
  type?: string;
  visibilityTime?: number;
  position?: 'top' | 'bottom';
  bottomOffset?: number;
};

// The bottom tab bar (BottomDock) is pinned to the bottom and its real height
// (content + safe-area inset) varies by device — on tall gesture-nav phones it
// is ~100-110px. The library's default bottomOffset of 40 places bottom toasts
// under the dock, hiding them. We lift bottom toasts above the measured dock
// height; until it is reported, a generous fallback clears most devices.
const DEFAULT_BOTTOM_OFFSET = 120;
const TOAST_DOCK_GAP = 12;

let measuredDockHeight = 0;

/** Reported by the BottomDock layout so toasts can clear the tab bar exactly. */
export function setToastDockInset(height: number): void {
  measuredDockHeight = Number.isFinite(height) && height > 0 ? height : 0;
}

function resolveBottomOffset(): number {
  return measuredDockHeight > 0 ? measuredDockHeight + TOAST_DOCK_GAP : DEFAULT_BOTTOM_OFFSET;
}

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
          ? { ...payload, bottomOffset: resolveBottomOffset() }
          : payload,
      );
    }
  } catch {
    // ignore
  }
}

export const showToastMessage = showToast
