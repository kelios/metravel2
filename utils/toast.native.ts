let toastModulePromise: Promise<any> | null = null;

export async function showToast(payload: any): Promise<void> {
  try {
    if (!toastModulePromise) {
      toastModulePromise = import('react-native-toast-message');
    }
    const mod = await toastModulePromise;
    const Toast = (mod as any)?.default ?? mod;
    if (Toast && typeof Toast.show === 'function') {
      Toast.show(payload);
    }
  } catch {
    // ignore
  }
}
