import React, { memo, Suspense, lazy } from 'react'
import {
  ActivityIndicator,
  Platform,
  View,
  ViewStyle,
  Text,
} from 'react-native'

import StickySearchBar from '@/components/mainPage/StickySearchBar'
import { TravelListSkeleton } from '@/components/SkeletonLoader'
import EmptyState from '@/components/EmptyState'
import type { Travel } from '@/src/types/types'
import { PER_PAGE } from './utils/listTravelConstants'

// Lazy load RecommendationsTabs with proper error boundary
const RecommendationsTabs = lazy(() =>
  import('./RecommendationsTabs').catch(() => ({
    default: () => (
      <View style={{ padding: 16, alignItems: 'center' }}>
        <Text>Не удалось загрузить рекомендации</Text>
      </View>
    ),
  })),
)

// Simple placeholder for loading state
const RecommendationsPlaceholder = () => (
  <View style={{ padding: 16, alignItems: 'center' }}>
    <ActivityIndicator size="small" />
  </View>
)

interface RightColumnProps {
  search: string
  setSearch: (value: string) => void
  isRecommendationsVisible: boolean
  handleRecommendationsVisibilityChange: (visible: boolean) => void
  activeFiltersCount: number
  total: number
  contentPadding: number
  showInitialLoading: boolean
  isError: boolean
  showEmptyState: boolean
  getEmptyStateMessage: any
  travels: Travel[]
  gridColumns: number
  isMobile: boolean
  showNextPageLoading: boolean
  refetch: () => void
  onFiltersPress?: () => void
  containerStyle?: ViewStyle | ViewStyle[]
  searchHeaderStyle?: ViewStyle | ViewStyle[]
  cardsContainerStyle?: ViewStyle | ViewStyle[]
  cardsGridStyle?: ViewStyle | ViewStyle[]
  footerLoaderStyle?: ViewStyle | ViewStyle[]
  renderItem: (travel: Travel, index: number) => React.ReactNode
}

const RightColumn: React.FC<RightColumnProps> = memo(
  ({
     search,
     setSearch,
     isRecommendationsVisible,
     handleRecommendationsVisibilityChange,
     activeFiltersCount,
     total,
     contentPadding,
     showInitialLoading,
     isError,
     showEmptyState,
     getEmptyStateMessage,
     travels,
     gridColumns,
     isMobile,
     showNextPageLoading,
     refetch,
     onFiltersPress,
     containerStyle,
     searchHeaderStyle,
     cardsContainerStyle,
     cardsGridStyle,
     footerLoaderStyle,
     renderItem,
   }) => {
    return (
      <View style={containerStyle}>
        {/* Search Header - Sticky */}
        <View style={searchHeaderStyle}>
          <StickySearchBar
            search={search}
            onSearchChange={setSearch}
            onFiltersPress={onFiltersPress}
            onToggleRecommendations={() =>
              handleRecommendationsVisibilityChange(!isRecommendationsVisible)
            }
            isRecommendationsVisible={isRecommendationsVisible}
            hasActiveFilters={activeFiltersCount > 0}
            resultsCount={total}
            activeFiltersCount={activeFiltersCount}
            onClearAll={() => {
              setSearch('')
            }}
          />
        </View>

        {/* Recommendations Tabs */}
        <View
          style={[
            { paddingHorizontal: contentPadding, marginBottom: 16 },
            !isRecommendationsVisible && { display: 'none' },
          ]}
        >
          <Suspense fallback={<RecommendationsPlaceholder />}>
            <RecommendationsTabs />
          </Suspense>
        </View>

        {/* Cards Container */}
        <View
          style={[
            cardsContainerStyle,
            { paddingHorizontal: contentPadding },
          ]}
        >
          {/* Initial Loading */}
          {showInitialLoading && (
            <View style={cardsGridStyle}>
              <TravelListSkeleton count={PER_PAGE} columns={gridColumns} />
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
                label: 'Повторить',
                onPress: () => refetch(),
              }}
            />
          )}

          {/* Empty State */}
          {!showInitialLoading &&
            !isError &&
            showEmptyState &&
            getEmptyStateMessage && (
              <EmptyState
                icon={getEmptyStateMessage.icon}
                title={getEmptyStateMessage.title}
                description={getEmptyStateMessage.description}
                variant={getEmptyStateMessage.variant}
              />
            )}

          {/* Travel Cards Grid */}
          {!showInitialLoading && !isError && !showEmptyState && (
            <View style={cardsGridStyle}>
              {travels.map((travel, index) => (
                <View
                  key={String(travel.id)}
                  style={[
                    { width: `${100 / gridColumns}%` as any },
                    Platform.OS === 'web' &&
                    (isMobile
                      ? {
                        maxWidth: '100%',
                        alignItems: 'stretch',
                      }
                      : {
                        maxWidth: 350,
                        alignItems: 'center',
                      }),
                  ]}
                >
                  {renderItem(travel, index)}
                </View>
              ))}

              {showNextPageLoading && (
                <View style={footerLoaderStyle}>
                  <ActivityIndicator size="small" />
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    )
  },
)

export default RightColumn
