// app/(tabs)/trips/community.tsx
// Каталог маршрутов сообщества (Sprint 13 / блок D, FE-community-routes).
import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useWebHydrationGate } from '@/hooks/useWebHydrationGate';

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

  if (!hydrationReady) {
    return <CommunityRoutesFallback />;
  }

  return (
    <Suspense fallback={<CommunityRoutesFallback />}>
      <CommunityRoutesCatalog />
    </Suspense>
  );
}
