// app/(tabs)/trips/community.tsx
// Каталог маршрутов сообщества (Sprint 13 / блок D, FE-community-routes).
import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import TripsPageSeo from '@/components/trips/TripsPageSeo';
import { useWebHydrationGate } from '@/hooks/useWebHydrationGate';
import { translate as i18nT } from '@/i18n';
import { routeMetadata } from '@/utils/seoRoutes/routeMetadata';
import { getTripsRouteSeo } from '@/components/trips/TripsPageSeo';

const CommunityRoutesCatalog = React.lazy(
  () => import('@/components/trips/planning/CommunityRoutesCatalog'),
);

function CommunityRoutesFallback() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}

export default function CommunityRoutesScreen() {
  const hydrationReady = useWebHydrationGate();

  return (
    <>
      <TripsPageSeo
        fallbackTitle="community"
      />
      {hydrationReady ? (
        <Suspense fallback={<CommunityRoutesFallback />}>
          <CommunityRoutesCatalog />
        </Suspense>
      ) : (
        <CommunityRoutesFallback />
      )}
    </>
  );
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); строки те же, что у экрана
export function generateMetadata() {
  const seo = getTripsRouteSeo('community')
  return routeMetadata({
    title: seo.title,
    description: i18nT('seoStatic:root.default.description'),
    canonical: seo.canonicalPath,
    ogType: 'website',
  });
}
