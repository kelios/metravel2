import { useMemo } from 'react';
import {
  Platform,
  View,
  type ViewStyle,
  type DimensionValue,
} from 'react-native';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import TravelListItemSkeleton from '@/components/listTravel/TravelListItemSkeleton';
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

const isOwnTravelTab = (tab: string) =>
  tab === 'travels' || tab === 'publishedTravels' || tab === 'draftTravels';

type ProfileGridGeometryArgs = Pick<ProfileTravelGridProps, 'isCardsSingleColumn' | 'gridColumns' | 'gapSize'>;

const SINGLE_COLUMN_CELL: ViewStyle = {
  width: '100%', maxWidth: '100%', minWidth: 0, flexBasis: '100%',
};

/**
 * Число колонок и ячейка сетки профиля — один расчёт для карточек и для их
 * каркаса (#2176). Каркас, собранный отдельно от сетки, стоял ниже карточек и
 * был другой формы, поэтому список прыгал в момент ответа API.
 */
export const resolveProfileGridGeometry = ({
  isCardsSingleColumn,
  gridColumns,
  gapSize,
}: ProfileGridGeometryArgs) => {
  const cols = Math.max(1, (isCardsSingleColumn ? 1 : gridColumns) || 1);
  // `calc()` понимает только web. На native ряд делит FlashList: `numColumns`
  // равных долей без зазора — каркас повторяет эти доли процентом.
  const cellWidth = (
    cols === 1
      ? '100%'
      : Platform.OS === 'web'
        ? `calc((100% - ${(cols - 1) * gapSize}px) / ${cols})`
        : `${100 / cols}%`
  ) as DimensionValue;
  const cellStyle: ViewStyle = isCardsSingleColumn
    ? SINGLE_COLUMN_CELL
    : {
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: cellWidth,
        width: cellWidth,
        maxWidth: cellWidth,
        minWidth: 0,
      };
  return { cols, cellWidth, cellStyle };
};

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
  const { cols, cellWidth, cellStyle } = useMemo(
    () => resolveProfileGridGeometry({ isCardsSingleColumn, gridColumns, gapSize }),
    [isCardsSingleColumn, gridColumns, gapSize],
  );

  const rows = useMemo(() => {
    const result: Travel[][] = [];
    for (let i = 0; i < currentData.length; i += cols) {
      result.push(currentData.slice(i, i + cols));
    }
    return result;
  }, [currentData, cols]);

  const placeholderBaseStyle = useMemo(() => ({
    flexGrow: 0, flexShrink: 0, minWidth: 0, opacity: 0, pointerEvents: 'none' as const,
  }), []);

  return (
    <>
      {rows.map((rowItems, rowIndex) => {
        const missingSlots = Math.max(0, cols - rowItems.length);

        return (
          <View key={`row-${rowIndex}`}>
            <View style={styles.cardsRow}>
              {rowItems.map((travel, itemIndex) => {
                return (
                  <View
                    key={String(travel.id)}
                    style={cellStyle}
                  >
                    <RenderTravelItem
                      item={travel}
                      index={rowIndex * cols + itemIndex}
                      isMobile={isMobileDevice}
                      isFirst={rowIndex === 0 && itemIndex === 0}
                      currentUserId={userId}
                      isSuperuser={isSuperuser}
                      onDeletePress={isOwnTravelTab(activeTab) ? handleDeleteMyTravel : undefined}
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
                      flexBasis: cellWidth,
                      width: cellWidth,
                      maxWidth: cellWidth,
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

type ProfileTravelGridSkeletonProps = ProfileGridGeometryArgs & {
  styles: ProfileScreenStyles;
};

/**
 * Каркас списка маршрутов профиля: один ряд той же сетки, что у карточек.
 * Сколько маршрутов придёт, до ответа неизвестно, а первый ряд закрывает
 * первый экран и на телефоне, и на мониторе.
 */
export function ProfileTravelGridSkeleton({
  styles,
  isCardsSingleColumn,
  gridColumns,
  gapSize,
}: ProfileTravelGridSkeletonProps) {
  const { cols, cellStyle } = useMemo(
    () => resolveProfileGridGeometry({ isCardsSingleColumn, gridColumns, gapSize }),
    [isCardsSingleColumn, gridColumns, gapSize],
  );

  return (
    <View style={styles.cardsRow} testID="profile-travel-grid-skeleton">
      {Array.from({ length: cols }).map((_, index) => (
        <View key={index} style={cellStyle}>
          <TravelListItemSkeleton />
        </View>
      ))}
    </View>
  );
}
