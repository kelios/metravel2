import { type ReactElement } from 'react';
import {
  View,
  ActivityIndicator,
  Platform,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { Travel } from '@/types/types';
import EmptyState from '@/components/ui/EmptyState';
import { ProfileTravelGrid, ProfileTravelGridSkeleton } from '@/components/screens/profile/ProfileTravelGrid';
import { keyExtractor } from '@/components/screens/profile/profileScreen.helpers';
import { webTouchScrollStyle } from '@/utils';
import type { ProfileTabKey } from '@/components/profile/ProfileTabs';
import type { createProfileScreenStyles } from '@/components/screens/profile/profileScreen.styles';
import { SCREEN_CONTENT_FIRST_PROPS } from '@/utils/screenContentMarker';

type ProfileStyles = ReturnType<typeof createProfileScreenStyles>;

const isProfileTravelTab = (tab: ProfileTabKey) =>
  tab === 'travels' || tab === 'publishedTravels' || tab === 'draftTravels';

type Props = {
  styles: ProfileStyles;
  colors: ReturnType<typeof import('@/hooks/useTheme').useThemedColors>;
  contentPaddingBottom: number;
  listHeader: ReactElement;
  /** Заглушка вкладки профиля: всегда `compact` (#2104), вид задаёт этот файл. */
  emptyStateProps: Omit<React.ComponentProps<typeof EmptyState>, 'density'>;
  currentData: Travel[];
  isSectionTab: boolean;
  isTravelsTabLoading: boolean;
  activeTab: ProfileTabKey;
  travelsLoadingMore: boolean;
  // grid + card props
  isCardsSingleColumn: boolean;
  gridColumns: number;
  gapSize: number;
  isMobileDevice: boolean;
  userId: string | null;
  isSuperuser: boolean;
  handleDeleteMyTravel: (id: number) => Promise<void>;
  width: number;
  removingTravelId: number | null;
  // web scroll wiring
  handleWebScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  handleWebLayout: (event: LayoutChangeEvent) => void;
  handleWebContentSizeChange: (contentWidth: number, contentHeight: number) => void;
  // native list wiring
  renderItem: (info: { item: Travel; index: number }) => React.ReactElement;
  refreshing: boolean;
  onRefresh: () => void;
  worldMapGestureActive: boolean;
  handleListEndReached: () => void;
};

export function ProfileTravelListView({
  styles,
  colors,
  contentPaddingBottom,
  listHeader,
  emptyStateProps,
  currentData,
  isSectionTab,
  isTravelsTabLoading,
  activeTab,
  travelsLoadingMore,
  isCardsSingleColumn,
  gridColumns,
  gapSize,
  isMobileDevice,
  userId,
  isSuperuser,
  handleDeleteMyTravel,
  width,
  removingTravelId,
  handleWebScroll,
  handleWebLayout,
  handleWebContentSizeChange,
  renderItem,
  refreshing,
  onRefresh,
  worldMapGestureActive,
  handleListEndReached,
}: Props) {
  const footer =
    isProfileTravelTab(activeTab) && travelsLoadingMore ? (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.primaryDark} />
      </View>
    ) : null;

  // Каркас — та же сетка и та же ячейка, что у карточек (#2176): своего отступа
  // у него нет, поэтому карточки встают ровно на его место.
  const listSkeleton = (
    <ProfileTravelGridSkeleton
      styles={styles}
      isCardsSingleColumn={isCardsSingleColumn}
      gridColumns={gridColumns}
      gapSize={gapSize}
    />
  );

  const emptyBody = isSectionTab ? null : isTravelsTabLoading ? (
    listSkeleton
  ) : (
    <View style={styles.emptyWrap}>
      <EmptyState {...emptyStateProps} density="compact" />
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <ScrollView
        style={[{ flex: 1 } as const, webTouchScrollStyle]}
        contentContainerStyle={[styles.listContent, { paddingBottom: contentPaddingBottom }]}
        onScroll={handleWebScroll}
        scrollEventThrottle={32}
        onLayout={handleWebLayout}
        onContentSizeChange={handleWebContentSizeChange}
      >
        {listHeader}
        {isSectionTab ? null : isTravelsTabLoading ? (
          <View testID="profile-travel-list">{listSkeleton}</View>
        ) : currentData.length === 0 ? (
          <View style={styles.emptyWrap} {...SCREEN_CONTENT_FIRST_PROPS}>
            <EmptyState {...emptyStateProps} density="compact" />
          </View>
        ) : (
          <View testID="profile-travel-list" {...SCREEN_CONTENT_FIRST_PROPS}>
            <ProfileTravelGrid
              currentData={currentData}
              styles={styles}
              isCardsSingleColumn={isCardsSingleColumn}
              gridColumns={gridColumns}
              gapSize={gapSize}
              isMobileDevice={isMobileDevice}
              userId={userId}
              isSuperuser={isSuperuser}
              activeTab={activeTab}
              handleDeleteMyTravel={handleDeleteMyTravel}
              width={width}
              removingTravelId={removingTravelId}
            />
          </View>
        )}
        {footer}
      </ScrollView>
    );
  }

  return (
    <FlashList
      key={`profile-list-${gridColumns}`}
      data={isTravelsTabLoading ? [] : currentData}
      // @ts-expect-error estimatedItemSize required by FlashList but types mismatch
      estimatedItemSize={280}
      ListHeaderComponent={listHeader}
      contentContainerStyle={[styles.listContent, { paddingBottom: contentPaddingBottom }]}
      keyExtractor={keyExtractor}
      numColumns={Math.max(1, (isCardsSingleColumn ? 1 : gridColumns) || 1)}
      renderItem={renderItem}
      refreshing={refreshing}
      onRefresh={onRefresh}
      scrollEnabled={!worldMapGestureActive}
      ListEmptyComponent={emptyBody}
      ListFooterComponent={footer}
      onEndReached={isProfileTravelTab(activeTab) ? handleListEndReached : undefined}
      onEndReachedThreshold={0.5}
    />
  );
}
