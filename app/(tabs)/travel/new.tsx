import { ActivityIndicator, View } from 'react-native';
import UpsertTravelRoute from '@/components/travel/upsert/UpsertTravelRoute';
import { useWebHydrationGate } from '@/hooks/useWebHydrationGate';

export default function NewTravelScreen() {
  const hydrationReady = useWebHydrationGate();

  if (!hydrationReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <UpsertTravelRoute />;
}
