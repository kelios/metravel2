import { useCallback, useEffect, useRef } from 'react';
import { requireNativeModule } from 'expo';
import { useRootNavigationState, useRouter, type Href } from 'expo-router';
import { Platform } from 'react-native';

import { mapIncomingAppLinkToHref } from '@/utils/incomingAppLinks';

type ExpoLinkingLifecycleModule = {
  addListener: (
    eventName: 'onURLReceived',
    listener: (event: unknown) => void,
  ) => { remove: () => void };
};

const DUPLICATE_EVENT_WINDOW_MS = 1_000;

const expoLinkingModule =
  requireNativeModule<ExpoLinkingLifecycleModule>('ExpoLinking');

function readUrlFromLifecycleEvent(event: unknown): unknown {
  if (typeof event === 'string') return event;
  if (typeof event !== 'object' || event === null) return null;
  return (event as { url?: unknown }).url;
}

/**
 * Android #1047 fallback: Expo Linking receives MainActivity.onNewIntent when the
 * legacy RN Linking channel does not. iOS must not subscribe here: Expo Router's
 * +native-intent owns both initial and warm URLs, avoiding a second router.push.
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
    const href = mapIncomingAppLinkToHref(url);
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
    if (Platform.OS !== 'android') return;

    const subscription = expoLinkingModule.addListener(
      'onURLReceived',
      (event) => {
        routeUrl(readUrlFromLifecycleEvent(event));
      },
    );

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
