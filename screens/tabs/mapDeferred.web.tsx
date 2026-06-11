import { lazy } from 'react';

export const MapOnboarding = lazy(() => import('@/components/MapPage/MapOnboarding'));
export const TravelListPanel = lazy(() => import('@/components/MapPage/TravelListPanel'));
export const MapMobileLayout = lazy(() =>
  Promise.resolve(import('@/components/MapPage/MapMobileLayout')).then((mod) => ({ default: mod.MapMobileLayout })),
);
export const ActiveFiltersBar = lazy(() =>
  Promise.resolve(import('@/components/MapPage/ActiveFiltersBar')).then((mod) => ({ default: mod.ActiveFiltersBar })),
);
