import { Platform } from 'react-native';
import { METRICS } from '@/constants/layout';

export type HeaderContextBarAction = 'map-panel' | 'travel-sections' | 'none';

type ResolveIsMobileArgs = {
  width: number;
  isPhone: boolean;
  isLargePhone: boolean;
  isJestEnv: boolean;
};

export function resolveHeaderContextBarIsMobile({
  width,
  isPhone,
  isLargePhone,
  isJestEnv,
}: ResolveIsMobileArgs): boolean {
  const effectiveWidth =
    Platform.OS === 'web' && !isJestEnv && typeof window !== 'undefined'
      ? window.innerWidth
      : width;

  return Platform.OS === 'web'
    ? effectiveWidth < METRICS.breakpoints.tablet
    : isPhone || isLargePhone;
}

export function resolveHeaderContextBarAction(pathname: string | null | undefined): HeaderContextBarAction {
  if (pathname === '/map' || pathname === '/userpoints') {
    return 'map-panel';
  }

  if (typeof pathname === 'string' && pathname.startsWith('/travels/')) {
    return 'travel-sections';
  }

  return 'none';
}
