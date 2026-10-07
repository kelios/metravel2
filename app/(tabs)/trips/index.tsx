import React from 'react';

import TripsPageSeo from '@/components/trips/TripsPageSeo';
import PublicTripsCatalog from '@/components/trips/PublicTripsCatalog';

export default function TripsScreen() {
  return (
    <>
      <TripsPageSeo
        canonicalPath="/trips"
        fallbackTitle="catalog"
      />
      <PublicTripsCatalog />
    </>
  );
}
