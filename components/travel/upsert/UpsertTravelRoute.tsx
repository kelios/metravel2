import { useCallback, useState } from 'react';

import TravelFormErrorBoundary from '@/components/travel/TravelFormErrorBoundary';
import UpsertTravel from '@/components/travel/UpsertTravel';

// Единый route-компонент для web и native. Раньше native-ветка размонтировала
// форму при потере фокуса экрана (`if (!isFocused) return null`), из-за чего
// уход и возврат в мастер терял весь введённый стейт. Держим форму
// смонтированной на всех платформах — как это всегда было на web.
export default function UpsertTravelRoute() {
  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = useCallback(() => {
    setRetryKey((value) => value + 1);
  }, []);

  return (
    <TravelFormErrorBoundary key={retryKey} onRetry={handleRetry}>
      <UpsertTravel />
    </TravelFormErrorBoundary>
  );
}
