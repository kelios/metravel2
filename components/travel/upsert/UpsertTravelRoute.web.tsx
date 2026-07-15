import { useCallback, useState } from 'react';

import TravelFormErrorBoundary from '@/components/travel/TravelFormErrorBoundary';
import UpsertTravel from '@/components/travel/UpsertTravel';

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
