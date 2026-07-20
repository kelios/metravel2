import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { SectionSkeleton } from '@/components/ui/SectionSkeleton';
import type { Travel } from '@/types/types';

import type { AnchorsMap } from './TravelDetailsTypes';
import {
  getInitialDeferredSectionsComponent,
  loadDeferredSectionsComponent,
  type DeferredSectionsComponentType,
} from './travelDetailsDeferredLoader';

type TravelDetailsPostLcpRuntimeProps = {
  travel: Travel;
  isMobile: boolean;
  anchors: AnchorsMap;
  forceOpenKey: string | null;
  scrollY?: any;
  settledScrollOffsetY?: number;
  viewportHeight?: number;
  scrollToMapSection: () => void;
};

const PLACEHOLDER_STYLE = { flex: 1 } as const;

function TravelDetailsPostLcpRuntime({
  travel,
  isMobile,
  anchors,
  forceOpenKey,
  scrollY,
  settledScrollOffsetY,
  viewportHeight,
  scrollToMapSection,
}: TravelDetailsPostLcpRuntimeProps) {
  const [DeferredSectionsComponent, setDeferredSectionsComponent] =
    useState<DeferredSectionsComponentType | null>(() => getInitialDeferredSectionsComponent());

  useEffect(() => {
    if (DeferredSectionsComponent) return;

    let cancelled = false;

    void loadDeferredSectionsComponent()
      .then((component) => {
        if (!cancelled) setDeferredSectionsComponent(() => component);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [DeferredSectionsComponent]);

  const deferredSectionsContent = useMemo(
    () =>
      DeferredSectionsComponent ? (
        <DeferredSectionsComponent
          travel={travel}
          isMobile={isMobile}
          forceOpenKey={forceOpenKey}
          anchors={anchors}
          scrollY={scrollY}
          settledScrollOffsetY={settledScrollOffsetY}
          viewportHeight={viewportHeight}
          scrollToMapSection={scrollToMapSection}
        />
      ) : (
        <View style={PLACEHOLDER_STYLE}>
          <SectionSkeleton />
        </View>
      ),
    [
      DeferredSectionsComponent,
      anchors,
      forceOpenKey,
      isMobile,
      scrollY,
      settledScrollOffsetY,
      scrollToMapSection,
      travel,
      viewportHeight,
    ],
  );

  return <>{deferredSectionsContent}</>;
}

export default React.memo(TravelDetailsPostLcpRuntime);
