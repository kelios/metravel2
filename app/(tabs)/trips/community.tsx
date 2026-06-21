// app/(tabs)/trips/community.tsx
// Каталог маршрутов сообщества (Sprint 13 / блок D, FE-community-routes).
import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

const CommunityRoutesCatalog = React.lazy(
  () => import('@/components/trips/planning/CommunityRoutesCatalog'),
);

export default function CommunityRoutesScreen() {
  return (
    <Suspense
      fallback={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      }
    >
      <CommunityRoutesCatalog />
    </Suspense>
  );
}
