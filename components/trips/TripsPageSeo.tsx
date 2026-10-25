import React from 'react';
import { useIsFocused } from 'expo-router';
import { useTranslation } from 'react-i18next';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import { translate as i18nT } from '@/i18n';
import { buildCanonicalUrl } from '@/utils/seo';

const TITLE_SUFFIX = ' | Metravel';

export const buildTripsPageTitle = (label: string): string => {
  const normalizedLabel = String(label || '').trim();
  return normalizedLabel ? `${normalizedLabel}${TITLE_SUFFIX}` : 'Metravel';
};

interface TripsPageSeoProps {
  /** Для статических страниц берётся из `TRIPS_ROUTE_SEO`; динамические (`/trips/:id`) передают свой путь. */
  canonicalPath?: string;
  fallbackTitle: TripsPageFallbackTitle;
  label?: string | null;
}

/**
 * Единый источник SEO страниц `trips`: ключ заголовка и canonical-путь статических
 * страниц. Читают и экран (`TripsPageSeo`), и `generateMetadata()` маршрута (#2740).
 */
export const TRIPS_ROUTE_SEO = {
  catalog: { titleKey: 'tripsStatic:seo.catalogTitle', canonicalPath: '/trips' },
  community: { titleKey: 'tripsStatic:seo.communityTitle', canonicalPath: '/trips/community' },
  create: { titleKey: 'tripsStatic:seo.createTitle', canonicalPath: '/trips/plan/create' },
  myTrips: { titleKey: 'tripsStatic:seo.myTripsTitle', canonicalPath: '/trips/my' },
  plan: { titleKey: 'tripsStatic:seo.planTitle' },
  publicTrip: { titleKey: 'tripsStatic:seo.publicTripTitle' },
} as const;

export type TripsPageFallbackTitle = keyof typeof TRIPS_ROUTE_SEO;

/** Заголовок (с суффиксом бренда) и canonical-путь страницы `trips`; `label` — реальное имя сущности. */
export const getTripsRouteSeo = (
  kind: TripsPageFallbackTitle,
  label?: string | null,
): { title: string; canonicalPath: string | undefined } => {
  const route: { titleKey: string; canonicalPath?: string } = TRIPS_ROUTE_SEO[kind];
  return {
    title: buildTripsPageTitle(label?.trim() || i18nT(route.titleKey)),
    canonicalPath: route.canonicalPath,
  };
};

// Several route tests replace expo-router with narrow mocks. Keep the production
// focus hook authoritative while allowing those shallow tests to render the
// otherwise web-only SEO boundary.
const useTripsRouteFocus =
  typeof useIsFocused === 'function' ? useIsFocused : () => true;

export default function TripsPageSeo({
  canonicalPath,
  fallbackTitle,
  label,
}: TripsPageSeoProps) {
  const isFocused = useTripsRouteFocus();
  useTranslation();

  if (!isFocused) return null;

  const seo = getTripsRouteSeo(fallbackTitle, label);
  const resolvedCanonicalPath = canonicalPath ?? seo.canonicalPath ?? '/';

  return (
    <InstantSEO
      headKey={`trips-${resolvedCanonicalPath}`}
      title={seo.title}
      canonical={buildCanonicalUrl(resolvedCanonicalPath)}
      ogType="website"
    />
  );
}
