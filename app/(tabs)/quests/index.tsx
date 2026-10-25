import { Suspense } from 'react';
import { View, ActivityIndicator } from 'react-native'
import QuestsScreenImpl from '@/screens/tabs/QuestsScreenRoute'
import { staticRouteMetadata } from '@/utils/seoRoutes/routeMetadata'

// Keep the route module tiny to avoid pulling heavy quest + location deps into the entry bundle.

export default function QuestsScreen() {
  return (
    <Suspense
      fallback={
        // testID doubles as the bundle-budget owner marker of this route chunk (#2654).
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} testID="quests-route-fallback">
          <ActivityIndicator />
        </View>
      }
    >
      <QuestsScreenImpl />
    </Suspense>
  )
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); значения — общая таблица
// utils/seoRoutes/staticRoutes.js, та же, что у SSG-генератора.
export function generateMetadata() {
  return staticRouteMetadata('/quests')
}
