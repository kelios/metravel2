import React from 'react';
import { useIsFocused } from 'expo-router';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import { useTranslation } from '@/i18n/LocaleProvider';
import { translate as i18nT } from '@/i18n';
import { buildCanonicalUrl } from '@/utils/seo';

const TITLE_SUFFIX = ' | Metravel';

export const buildTripsPageTitle = (label: string): string => {
  const normalizedLabel = String(label || '').trim();
  return normalizedLabel ? `${normalizedLabel}${TITLE_SUFFIX}` : 'Metravel';
};

interface TripsPageSeoProps {
  canonicalPath: string;
  fallbackTitle: TripsPageFallbackTitle;
  label?: string | null;
}

type TripsPageFallbackTitle =
  | 'catalog'
  | 'community'
  | 'create'
  | 'myTrips'
  | 'plan'
  | 'publicTrip';

const getFallbackTitle = (fallbackTitle: TripsPageFallbackTitle): string => {
  switch (fallbackTitle) {
    case 'catalog':
      return i18nT('tripsStatic:seo.catalogTitle');
    case 'community':
      return i18nT('tripsStatic:seo.communityTitle');
    case 'create':
      return i18nT('tripsStatic:seo.createTitle');
    case 'myTrips':
      return i18nT('tripsStatic:seo.myTripsTitle');
    case 'plan':
      return i18nT('tripsStatic:seo.planTitle');
    case 'publicTrip':
      return i18nT('tripsStatic:seo.publicTripTitle');
  }
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

  return (
    <InstantSEO
      headKey={`trips-${canonicalPath}`}
      title={buildTripsPageTitle(label?.trim() || getFallbackTitle(fallbackTitle))}
      canonical={buildCanonicalUrl(canonicalPath)}
      ogType="website"
    />
  );
}
