import React, { memo, Suspense, lazy, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ActivityIndicator,
  Platform,
  View,
  ViewStyle,
  Text,
  ScrollView,
  LayoutChangeEvent,
  StyleProp,
} from 'react-native'

import StickySearchBar from '@/components/mainPage/StickySearchBar'
import { TravelListSkeleton } from '@/components/SkeletonLoader'
import EmptyState from '@/components/EmptyState'
import type { Travel } from '@/src/types/types'
import { PER_PAGE } from './utils/listTravelConstants'

// Lazy load RecommendationsTabs with proper error boundary
const RecommendationsTabs = lazy(async () => {
  try {
    return await import('./RecommendationsTabs')
  } catch (error) {
    return {
      default: memo(() => (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Text>Не удалось загрузить рекомендации</Text>
        </View>
      )),
    }
  }
})

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
  cardSpacing?: number
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
     cardSpacing = 16,
   }) => {
    const scrollViewRef = useRef<ScrollView | null>(null)
    const recommendationsOffsetRef = useRef(0)
    const shouldScrollRef = useRef(false)
    const prevVisibilityRef = useRef(isRecommendationsVisible)

    const scrollToRecommendations = useCallback(() => {
      if (!scrollViewRef.current) return
      const target = Math.max(recommendationsOffsetRef.current - 16, 0)
      scrollViewRef.current.scrollTo({ y: target, animated: true })
      shouldScrollRef.current = false
    }, [])

    const handleRecommendationsLayout = useCallback((event: LayoutChangeEvent) => {
      recommendationsOffsetRef.current = event.nativeEvent.layout.y
      if (shouldScrollRef.current) {
        shouldScrollRef.current = false
        scrollToRecommendations()
      }
    }, [scrollToRecommendations])

    useEffect(() => {
      if (isRecommendationsVisible && !prevVisibilityRef.current) {
        if (recommendationsOffsetRef.current > 0) {
          scrollToRecommendations()
        } else {
          shouldScrollRef.current = true
        }
      } else {
        shouldScrollRef.current = false
      }

      prevVisibilityRef.current = isRecommendationsVisible
    }, [isRecommendationsVisible, scrollToRecommendations])

    const cardsWrapperStyle = useMemo<StyleProp<ViewStyle>>(() => {
      const resetPadding = { paddingHorizontal: 0, paddingTop: 12 }

      if (Array.isArray(cardsContainerStyle)) {
        return [...cardsContainerStyle, resetPadding]
      }

      if (cardsContainerStyle) {
        return [cardsContainerStyle, resetPadding]
      }

      return resetPadding
    }, [cardsContainerStyle])

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

        {/* Cards + Recommendations */}
        <View style={cardsWrapperStyle}>
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: contentPadding,
              paddingTop: 8,
              paddingBottom: 28,
            }}
            scrollEventThrottle={16}
          >
            {isRecommendationsVisible && (
              <View
                onLayout={handleRecommendationsLayout}
                style={{ marginBottom: 24 }}
              >
                <Suspense fallback={<RecommendationsPlaceholder />}>
                  <RecommendationsTabs />
                </Suspense>
              </View>
            )}

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
                      Platform.OS === 'web'
                        ? {
                          alignSelf: 'stretch',
                          alignItems: 'stretch',
                          paddingBottom: cardSpacing,
                          paddingRight: cardSpacing / 2,
                          paddingLeft: cardSpacing / 2,
                        }
                        : {
                          paddingHorizontal: cardSpacing / 2,
                          paddingBottom: cardSpacing,
                          alignItems: 'stretch',
                        },
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
          </ScrollView>
        </View>
      </View>
    )
  },
)

export default RightColumn
