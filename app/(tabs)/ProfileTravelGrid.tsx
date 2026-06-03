import { useMemo } from 'react';
import {
  View,
  type ViewStyle,
  type DimensionValue,
} from 'react-native';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import type { Travel } from '@/types/types';
import type { createProfileScreenStyles } from './profileScreen.styles';

type ProfileScreenStyles = ReturnType<typeof createProfileScreenStyles>;

interface ProfileTravelGridProps {
  currentData: Travel[];
  styles: ProfileScreenStyles;
  isCardsSingleColumn: boolean;
  gridColumns: number;
  gapSize: number;
  isMobileDevice: boolean;
  userId: string | null;
  isSuperuser: boolean;
  activeTab: string;
  handleDeleteMyTravel: (id: number) => Promise<void>;
  width: number;
  removingTravelId: number | null;
}

export function ProfileTravelGrid({
  currentData,
  styles,
  isCardsSingleColumn,
  gridColumns,
  gapSize,
  isMobileDevice,
  userId,
  isSuperuser,
  activeTab,
  handleDeleteMyTravel,
  width,
  removingTravelId,
}: ProfileTravelGridProps) {
  const rows = useMemo(() => {
    const cols = Math.max(1, (isCardsSingleColumn ? 1 : gridColumns) || 1);
    const result: Travel[][] = [];
    for (let i = 0; i < currentData.length; i += cols) {
      result.push(currentData.slice(i, i + cols));
    }
    return result;
  }, [currentData, gridColumns, isCardsSingleColumn]);

  const singleColStyle = useMemo(() => ({
    width: '100%', maxWidth: '100%', minWidth: 0, flexBasis: '100%',
  } as ViewStyle), []);

  const placeholderBaseStyle = useMemo(() => ({
    flexGrow: 0, flexShrink: 0, minWidth: 0, opacity: 0, pointerEvents: 'none' as const,
  }), []);

  return (
    <>
      {rows.map((rowItems, rowIndex) => {
        const cols = Math.max(1, (isCardsSingleColumn ? 1 : gridColumns) || 1);
        const missingSlots = Math.max(0, cols - rowItems.length);
        const calcWidth =
          cols > 1
            ? `calc((100% - ${(cols - 1) * gapSize}px) / ${cols})`
            : '100%';

        return (
          <View key={`row-${rowIndex}`}>
            <View style={styles.cardsRow}>
              {rowItems.map((travel, itemIndex) => {
                const rowItemStyle: ViewStyle | undefined = isCardsSingleColumn
                  ? singleColStyle
                  : {
                      flexGrow: 0,
                      flexShrink: 0,
                      flexBasis: calcWidth as DimensionValue,
                      width: calcWidth as DimensionValue,
                      maxWidth: calcWidth as DimensionValue,
                      minWidth: 0,
                    };

                return (
                  <View
                    key={String(travel.id)}
                    style={rowItemStyle}
                  >
                    <RenderTravelItem
                      item={travel}
                      index={rowIndex * cols + itemIndex}
                      isMobile={isMobileDevice}
                      isFirst={rowIndex === 0 && itemIndex === 0}
                      currentUserId={userId}
                      isSuperuser={isSuperuser}
                      onDeletePress={activeTab === 'travels' ? handleDeleteMyTravel : undefined}
                      viewportWidth={width}
                       isDeleting={removingTravelId === travel.id}
                    />
                  </View>
                );
              })}

              {!isCardsSingleColumn && missingSlots > 0
                ? Array.from({ length: missingSlots }).map((_, placeholderIndex) => {
                    const placeholderStyle: ViewStyle = {
                      ...placeholderBaseStyle,
                      flexBasis: calcWidth as DimensionValue,
                      width: calcWidth as DimensionValue,
                      maxWidth: calcWidth as DimensionValue,
                    };
                    return (
                      <View
                        key={`placeholder-${rowIndex}-${placeholderIndex}`}
                        style={placeholderStyle}
                      />
                    );
                  })
                : null}
            </View>
            {rowIndex < rows.length - 1 ? <View style={styles.rowSeparator} /> : null}
          </View>
        );
      })}
    </>
  );
}
