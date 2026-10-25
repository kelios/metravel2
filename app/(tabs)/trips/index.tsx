import React from 'react';

import TripsPageSeo from '@/components/trips/TripsPageSeo';
import PublicTripsCatalog from '@/components/trips/PublicTripsCatalog';
import { translate as i18nT } from '@/i18n';
import { routeMetadata } from '@/utils/seoRoutes/routeMetadata';
import { getTripsRouteSeo } from '@/components/trips/TripsPageSeo';

export default function TripsScreen() {
  return (
    <>
      <TripsPageSeo
        fallbackTitle="catalog"
      />
      <PublicTripsCatalog />
    </>
  );
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); строки те же, что у экрана
export function generateMetadata() {
  const seo = getTripsRouteSeo('catalog')
  return routeMetadata({
    title: seo.title,
    description: i18nT('seoStatic:root.default.description'),
    canonical: seo.canonicalPath,
    ogType: 'website',
  });
}
