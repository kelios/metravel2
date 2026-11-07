import type { NativeIntent } from 'expo-router';

import { resolveIncomingAppLink } from '@/utils/incomingAppLinkFallback';

/**
 * Expo Router calls this for both the initial iOS URL and subsequent Linking events.
 * Returning null is fail-closed: no route is interpolated and a warm app stays put.
 * #3104: a safe site link without an app screen is handed to the system browser
 * before that null, so an Android App Link never silently lands on the home tab.
 */
export const redirectSystemPath: NonNullable<
  NativeIntent['redirectSystemPath']
> = ({ path }) => resolveIncomingAppLink(path);
