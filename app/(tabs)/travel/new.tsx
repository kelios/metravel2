import React, { Suspense } from 'react';
import { useIsFocused } from '@react-navigation/native';

const UpsertTravel = React.lazy(() => import('@/components/travel/UpsertTravel'));

export default function NewTravelScreen() {
    const isFocused = useIsFocused();

    return (
        <Suspense fallback={<div>Loading...</div>}>
            {isFocused ? <UpsertTravel /> : null}
        </Suspense>
    );
}