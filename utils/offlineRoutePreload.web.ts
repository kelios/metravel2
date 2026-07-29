let preloadPromise: Promise<void> | null = null;

const preloadImage = (src: string): Promise<void> => {
  if (typeof window === 'undefined' || typeof window.Image !== 'function') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
};

/**
 * The web build has no Service Worker guarantee. Load the offline-library route
 * and the mobile header chunks it reveals while the shell is online, so a later
 * in-app transition does not request code or chrome assets after connectivity
 * has already disappeared. This is especially important on /map, where the
 * mobile header is intentionally not mounted until another route opens.
 */
export function preloadOfflineRoute(): Promise<void> {
  if (!preloadPromise) {
    const attempt = Promise.all([
      import('@/app/(tabs)/offline'),
      import('@/components/layout/HeaderContextBar'),
      import('@/components/layout/CustomHeaderAccountSection'),
      import('@/components/layout/CustomHeaderMobileAccountSection'),
      preloadImage('/assets/icons/logo_yellow_60x60.png'),
    ]).then(() => undefined);
    preloadPromise = attempt.catch((error) => {
      preloadPromise = null;
      throw error;
    });
  }
  return preloadPromise;
}
