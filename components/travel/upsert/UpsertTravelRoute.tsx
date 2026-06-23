import React, { useCallback, useState } from 'react';
import { useIsFocused } from 'expo-router';

import TravelFormErrorBoundary from '@/components/travel/TravelFormErrorBoundary';
import UpsertTravel from '@/components/travel/UpsertTravel';

export default function UpsertTravelRoute() {
  const isFocused = useIsFocused();
  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = useCallback(() => {
    setRetryKey((value) => value + 1);
  }, []);

  if (!isFocused) return null;

  return (
    <TravelFormErrorBoundary key={retryKey} onRetry={handleRetry}>
      <UpsertTravel />
    </TravelFormErrorBoundary>
  );
}
