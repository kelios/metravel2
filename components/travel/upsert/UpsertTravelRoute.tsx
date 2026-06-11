import React from 'react';
import { useIsFocused } from 'expo-router';

import UpsertTravel from '@/components/travel/UpsertTravel';

export default function UpsertTravelRoute() {
  const isFocused = useIsFocused();
  return isFocused ? <UpsertTravel /> : null;
}
