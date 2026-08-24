import type { NativeIntent } from 'expo-router';

import { mapIncomingAppLinkToHref } from '@/utils/incomingAppLinks';

/**
 * Expo Router calls this for both the initial iOS URL and subsequent Linking events.
 * Returning null is fail-closed: no route is interpolated and a warm app stays put.
 */
export const redirectSystemPath: NonNullable<
  NativeIntent['redirectSystemPath']
> = ({ path }) => mapIncomingAppLinkToHref(path);
