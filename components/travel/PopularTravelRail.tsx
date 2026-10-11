import { Platform, View } from 'react-native';
import CardRail from '@/components/ui/CardRail';
import TravelListItem from '@/components/listTravel/TravelListItem';
import type { Travel } from '@/types/types';
import {
  NEAR_RAIL_PADDING_VERTICAL,
  nearTravelRailStyles,
  useNearTravelRailLayout,
  useNearTravelRailSlotStyle,
} from '@/components/travel/NearTravelListSkeleton';
import { getTravelDetailsListColumnWidth } from '@/components/travel/utils/travelDetailsListLayout';
import { translate as i18nT } from '@/i18n';

export function PopularTravelRail({ travels }: { travels: readonly Travel[] }) {
  const layout = useNearTravelRailLayout();
  const slotStyle = useNearTravelRailSlotStyle(layout);
  return (
    <View style={layout.isMobile ? nearTravelRailStyles.mobileListContent : nearTravelRailStyles.listColumn}>
      <CardRail
        gap={layout.gap}
        contentPaddingHorizontal={0}
        contentPaddingVertical={NEAR_RAIL_PADDING_VERTICAL}
        contentStyle={layout.contentStyle}
        hideArrows={layout.isMobile}
        accessibilityLabel={i18nT('travel:components.travel.PopularTravelList.populyarnye_marshruty_0c904445')}
        testID="popular-travel-rail"
      >
        {travels.map((travel, index) => (
          <View key={travel.id} style={slotStyle} testID="popular-travel-rail-slot"
            {...(Platform.OS === 'web' ? { role: 'listitem' as const } : {})}>
            <TravelListItem
              travel={travel}
              isFirst={index === 0}
              isMobile={layout.isMobile}
              viewportWidth={layout.width}
              cardWidth={layout.slotWidth ?? getTravelDetailsListColumnWidth(layout.width, layout.numColumns)}
              webTouchAction="pan-x pan-y"
            />
          </View>
        ))}
      </CardRail>
    </View>
  );
}
