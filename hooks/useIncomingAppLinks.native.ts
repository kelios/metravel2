import { useCallback, useEffect, useRef } from 'react';
import { requireNativeModule } from 'expo';
import { useRootNavigationState, useRouter, type Href } from 'expo-router';

type ExpoLinkingLifecycleModule = {
  addListener: (
    eventName: 'onURLReceived',
    listener: (event: unknown) => void,
  ) => { remove: () => void };
};

const DUPLICATE_EVENT_WINDOW_MS = 1_000;

const expoLinkingModule =
  requireNativeModule<ExpoLinkingLifecycleModule>('ExpoLinking');

/**
 * Convert an Android App Link/custom-scheme URL into an internal Expo Router href.
 * Hash fragments are web-only navigation state, so native intentionally drops them.
 */
export function normalizeIncomingAppLink(url: unknown): string | null {
  if (typeof url !== 'string' || url.length === 0) return null;

  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.toLowerCase();
    let pathname: string;

    if (protocol === 'https:') {
      if (
        parsed.hostname.toLowerCase() !== 'metravel.by' ||
        parsed.port !== '' ||
        parsed.username !== '' ||
        parsed.password !== ''
      ) {
        return null;
      }
      pathname = parsed.pathname || '/';
    } else if (protocol === 'metravel:') {
      // Both metravel://travels/slug and metravel:///travels/slug are valid.
      const routeParts = [parsed.hostname, parsed.pathname.replace(/^\/+/, '')]
        .filter(Boolean);
      pathname = routeParts.length > 0 ? `/${routeParts.join('/')}` : '/';
    } else {
      return null;
    }

    if (pathname === '/') return null;

    return `${pathname.startsWith('/') ? pathname : `/${pathname}`}${parsed.search}`;
  } catch {
    return null;
  }
}

function readUrlFromLifecycleEvent(event: unknown): unknown {
  if (typeof event === 'string') return event;
  if (typeof event !== 'object' || event === null) return null;
  return (event as { url?: unknown }).url;
}

/**
 * Expo Router 57 still consumes Android warm links through the legacy RN Linking
 * emitter. Expo Linking's lifecycle listener receives MainActivity.onNewIntent
 * independently, so subscribe to that channel and route once navigation is ready.
 * Cold-start URLs remain owned by Expo Router's initial-URL bootstrap.
 */
export function useIncomingAppLinks(): void {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const isNavigationReady = Boolean(rootNavigationState?.key);
  const routerRef = useRef(router);
  const isNavigationReadyRef = useRef(isNavigationReady);
  const pendingHrefRef = useRef<string | null>(null);
  const lastNavigationRef = useRef<{ href: string; at: number } | null>(null);

  routerRef.current = router;
  isNavigationReadyRef.current = isNavigationReady;

  const routeUrl = useCallback((url: unknown) => {
    const href = normalizeIncomingAppLink(url);
    if (!href) return;

    if (!isNavigationReadyRef.current) {
      pendingHrefRef.current = href;
      return;
    }

    const now = Date.now();
    const lastNavigation = lastNavigationRef.current;
    if (
      lastNavigation?.href === href &&
      now - lastNavigation.at <= DUPLICATE_EVENT_WINDOW_MS
    ) {
      return;
    }

    lastNavigationRef.current = { href, at: now };
    routerRef.current.push(href as Href);
  }, []);

  useEffect(() => {
    const subscription = expoLinkingModule.addListener('onURLReceived', (event) => {
      routeUrl(readUrlFromLifecycleEvent(event));
    });

    return () => subscription.remove();
  }, [routeUrl]);

  useEffect(() => {
    if (!isNavigationReady) return;
    const pendingHref = pendingHrefRef.current;
    if (!pendingHref) return;

    pendingHrefRef.current = null;
    lastNavigationRef.current = { href: pendingHref, at: Date.now() };
    routerRef.current.push(pendingHref as Href);
  }, [isNavigationReady]);
}
