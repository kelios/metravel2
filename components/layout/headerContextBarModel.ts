import { Platform } from 'react-native';
import { METRICS } from '@/constants/layout';

export type HeaderContextBarAction = 'map-panel' | 'travel-sections' | 'none';

type ResolveIsMobileArgs = {
  width: number;
  isPhone: boolean;
  isLargePhone: boolean;
};

export function resolveHeaderContextBarIsMobile({
  width,
  isPhone,
  isLargePhone,
}: ResolveIsMobileArgs): boolean {
  // width уже из useResponsive (hydration-safe: SSR и первый клиентский рендер дают 0).
  // Прямое чтение window.innerWidth здесь давало расхождение SSR→клиент (React #418).
  return Platform.OS === 'web'
    ? width < METRICS.breakpoints.tablet
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
