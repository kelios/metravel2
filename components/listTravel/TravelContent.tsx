import React from 'react';
import { View, Platform, ActivityIndicator } from 'react-native';
import type { ViewStyle } from 'react-native';
import StickySearchBar from '@/components/mainPage/StickySearchBar';
import EmptyState from '@/components/EmptyState';
import { TravelListSkeleton } from '@/components/SkeletonLoader';
import MemoizedTravelItem from './TravelListItem';
import type { Travel } from '@/src/types/types';

interface TravelContentProps {
  // Search props
  search: string;
  setSearch: (search: string) => void;
  onFiltersPress: () => void;
  onToggleRecommendations: () => void;
  isRecommendationsVisible: boolean;
  hasActiveFilters: boolean;
  total: number;
  activeFiltersCount: number;
  onClearAll: () => void;

  // Content props
  contentPadding: number;
  showInitialLoading: boolean;
  isError: boolean;
  showEmptyState: boolean;
  getEmptyStateMessage: any;
  travels: Travel[];
  gridColumns: number;
  showNextPageLoading: boolean;
  isMobile: boolean;
  isSuper: boolean;
  isMeTravel: boolean;
  isExport: boolean;
  setDelete: (id: number | null) => void;
  isSelected: (id: number) => boolean;
  toggleSelect: (travel: Travel) => void;
  refetch: () => void;
}

const TravelContent: React.FC<TravelContentProps> = ({
  search,
  setSearch,
  onFiltersPress,
  onToggleRecommendations,
  isRecommendationsVisible,
  hasActiveFilters,
  total,
  activeFiltersCount,
  onClearAll,
  contentPadding,
  showInitialLoading,
  isError,
  showEmptyState,
  getEmptyStateMessage,
  travels,
  gridColumns,
  showNextPageLoading,
  isMobile,
  isSuper,
  isMeTravel,
  isExport,
  setDelete,
  isSelected,
  toggleSelect,
  refetch,
}) => {
  return (
    <View style={{ flex: 1 }}>
      {/* Search Header - Sticky */}
      <View style={{
        position: 'sticky' as any,
        top: 0,
        zIndex: 10,
        backgroundColor: 'white',
      }}>
        <StickySearchBar
          search={search}
          onSearchChange={setSearch}
          onFiltersPress={onFiltersPress}
          onToggleRecommendations={onToggleRecommendations}
          isRecommendationsVisible={isRecommendationsVisible}
          hasActiveFilters={hasActiveFilters}
          resultsCount={total}
          activeFiltersCount={activeFiltersCount}
          onClearAll={onClearAll}
        />
      </View>

      {/* Cards Container - Scrollable */}
      <View style={{
        flex: 1,
        paddingHorizontal: contentPadding,
        paddingTop: 16,
      }}>
        {/* Loading */}
        {showInitialLoading && (
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 16,
          }}>
            <TravelListSkeleton count={20} columns={gridColumns} />
          </View>
        )}

        {/* Error */}
        {isError && !showInitialLoading && (
          <EmptyState
            icon="alert-circle"
            title="Ошибка загрузки"
            description="Не удалось загрузить путешествия."
            variant="error"
            action={{
              label: "Повторить",
              onPress: () => refetch(),
            }}
          />
        )}

        {/* Empty State */}
        {!showInitialLoading && !isError && showEmptyState && getEmptyStateMessage && (
          <EmptyState
            icon={getEmptyStateMessage.icon}
            title={getEmptyStateMessage.title}
            description={getEmptyStateMessage.description}
            variant={getEmptyStateMessage.variant}
          />
        )}

        {/* Travel Cards Grid */}
        {!showInitialLoading && !isError && !showEmptyState && (
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 16,
          }}>
            {travels.map((travel, index) => (
              <View
                key={String(travel.id)}
                style={[
                  Platform.select({
                    web: {
                      flexGrow: 1,
                      flexShrink: 1,
                      flexBasis: 300,
                      minWidth: 300,
                      maxWidth: 360,
                    },
                    default: {
                      width: '100%',
                      maxWidth: '100%',
                    },
                  }) as ViewStyle,
                ]}
              >
                <MemoizedTravelItem
                  travel={travel}
                  isMobile={isMobile}
                  isSuperuser={isSuper}
                  isMetravel={isMeTravel}
                  onDeletePress={setDelete}
                  isFirst={index === 0}
                  selectable={isExport}
                  isSelected={isSelected(travel.id)}
                  onToggle={() => toggleSelect(travel)}
                />
              </View>
            ))}
            {showNextPageLoading && (
              <View style={{
                width: '100%',
                alignItems: 'center',
                paddingVertical: 16,
              }}>
                <ActivityIndicator size="small" />
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

export default TravelContent;
