import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { SectionSkeleton } from '@/components/ui/SectionSkeleton';
import type { Travel } from '@/types/types';
import { translate as i18nT } from '@/i18n';

import type { AnchorsMap } from './TravelDetailsTypes';
import {
  getInitialDeferredSectionsComponent,
  loadDeferredSectionsComponent,
  type DeferredSectionsComponentType,
} from './travelDetailsDeferredLoader';
import {
  TravelDetailsDeferredSectionsSkeleton,
  TravelDetailsDeferredTransition,
} from './TravelDetailsDeferredTransition';

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

const NATIVE_PLACEHOLDER_STYLE = { flex: 1 } as const;

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
  const [deferredSectionsLoadFailed, setDeferredSectionsLoadFailed] = useState(false);

  useEffect(() => {
    if (DeferredSectionsComponent || deferredSectionsLoadFailed) return;

    let cancelled = false;

    void loadDeferredSectionsComponent()
      .then((component) => {
        if (!cancelled) setDeferredSectionsComponent(() => component);
      })
      .catch(() => {
        if (!cancelled && Platform.OS === 'web') setDeferredSectionsLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [DeferredSectionsComponent, deferredSectionsLoadFailed]);

  const deferredSectionsContent = useMemo(
    () => {
      const placeholder = Platform.OS === 'web' ? (
        <TravelDetailsDeferredSectionsSkeleton isMobile={isMobile} />
      ) : (
        <View style={NATIVE_PLACEHOLDER_STYLE}>
          <SectionSkeleton />
        </View>
      );

      return (
        <TravelDetailsDeferredTransition
          testID="travel-details-deferred-transition"
          isMobile={isMobile}
          pending={!DeferredSectionsComponent && !deferredSectionsLoadFailed}
          placeholder={placeholder}
        >
          {DeferredSectionsComponent ? (
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
          ) : deferredSectionsLoadFailed ? (
            <View testID="travel-details-deferred-load-error">
              <Text>
                {i18nT(
                  'travel:components.travel.details.TravelDetailsLazy.component_failed_to_load_05315fe8',
                )}
              </Text>
            </View>
          ) : null}
        </TravelDetailsDeferredTransition>
      );
    },
    [
      DeferredSectionsComponent,
      anchors,
      deferredSectionsLoadFailed,
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
