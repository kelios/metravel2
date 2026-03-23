export type ToastPayload = {
  text1?: string;
  text2?: string;
  type?: string;
  visibilityTime?: number;
  position?: 'top' | 'bottom';
};

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
      toastModulePromise = import('react-native-toast-message') as Promise<NativeToastModule>;
    }
    const mod = await toastModulePromise;
    const Toast = mod.default ?? mod;
    if (Toast && typeof Toast.show === 'function') {
      Toast.show(payload);
    }
  } catch {
    // ignore
  }
}
