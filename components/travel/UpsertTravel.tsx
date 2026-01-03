import React from 'react';

import {
  initFilters,
  normalizeCategoryTravelAddress,
  normalizeTravelCategories,
} from '@/hooks/useTravelFilters';

import UpsertTravelView from '@/components/travel/upsert/UpsertTravelView';
import { useUpsertTravelController } from '@/components/travel/upsert/useUpsertTravelController';

export { initFilters, normalizeCategoryTravelAddress, normalizeTravelCategories };

export default function UpsertTravel() {
  const controller = useUpsertTravelController();
  return <UpsertTravelView controller={controller} />;
}
