import React, { memo } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'

import EmptyState from '@/components/ui/EmptyState'
import {
  RecommendationsPlaceholder,
  TravelCardSkeletonComponent,
} from '@/components/listTravel/RightColumn.parts'
import type { RightColumnProps } from '@/components/listTravel/RightColumn'
import { translate as i18nT } from '@/i18n'

/**
 * #2179: состояние списка до результатов — скелетон, сбой, пустая выдача.
 * Рисуется как `ListEmptyComponent` того же FlashList, что и карточки: у
 * каталога один владелец прокрутки во всех фазах, поэтому SEO-интро в шапке
 * списка не теряет позицию, когда приходят результаты. Горизонтальный отступ
 * и верхний зазор даёт контейнер содержимого списка, как и рядам карточек.
 */
type RightColumnListStatusProps = Pick<
  RightColumnProps,
  | 'isRecommendationsVisible'
  | 'showInitialLoading'
  | 'isError'
  | 'refetch'
  | 'showEmptyState'
  | 'getEmptyStateMessage'
  | 'activeFiltersCount'
  | 'search'
  | 'onClearAll'
  | 'setSearch'
> & {
  shouldShowSkeleton: boolean
  isOffline: boolean
  initialSkeletonCount: number
  recommendationsSkeletonStyle: StyleProp<ViewStyle>
  skeletonGridStyle: StyleProp<ViewStyle>
  skeletonCardWrapperStyle: StyleProp<ViewStyle>
}

function RightColumnListStatus({
  shouldShowSkeleton,
  isRecommendationsVisible,
  showInitialLoading,
  isError,
  isOffline,
  refetch,
  showEmptyState,
  getEmptyStateMessage,
  activeFiltersCount,
  search,
  onClearAll,
  setSearch,
  initialSkeletonCount,
  recommendationsSkeletonStyle,
  skeletonGridStyle,
  skeletonCardWrapperStyle,
}: RightColumnListStatusProps) {
  return (
    <>
      {shouldShowSkeleton && isRecommendationsVisible && (
        <View
          style={recommendationsSkeletonStyle}
        >
          <RecommendationsPlaceholder />
        </View>
      )}

      {/* Initial Loading - local shell for all layouts */}
      {shouldShowSkeleton && (
        <View style={skeletonGridStyle}>
          {Array.from({ length: initialSkeletonCount }).map((_, idx) => (
            <View key={`travel-skeleton-${idx}`} style={skeletonCardWrapperStyle}>
              <TravelCardSkeletonComponent />
            </View>
          ))}
        </View>
      )}

      {/* Error — на native при отсутствии сети показываем отдельный
          «нет подключения», а не общий сбой загрузки. */}
      {isError && !showInitialLoading && (
        <View>
          {isOffline ? (
            <EmptyState
              density="compact"
              icon="wifi-off"
              title={i18nT('travel:components.listTravel.RightColumn.net_podklyucheniya_fb445d25')}
              description={i18nT('travel:components.listTravel.RightColumn.proverte_internet_soedinenie_i_poprobuyte_sn_99ebb55e')}
              variant="error"
              action={{
                label: i18nT('travel:components.listTravel.RightColumn.povtorit_340c3e03'),
                onPress: () => refetch(),
              }}
            />
          ) : (
            <EmptyState
              density="compact"
              icon="alert-circle"
              title={i18nT('travel:components.listTravel.RightColumn.oshibka_zagruzki_3d856d87')}
              description={i18nT('travel:components.listTravel.RightColumn.ne_udalos_zagruzit_puteshestviya_7460434d')}
              variant="error"
              action={{
                label: i18nT('travel:components.listTravel.RightColumn.povtorit_340c3e03'),
                onPress: () => refetch(),
              }}
            />
          )}
        </View>
      )}

      {/* Empty State */}
      {!showInitialLoading &&
        !isError &&
        showEmptyState &&
        getEmptyStateMessage && (
          <View>
            <EmptyState
              // Поиск с подсказками сохраняет полный вид (#2104 вне scope), прочее — компактно.
              density={getEmptyStateMessage.variant === 'search' ? 'full' : 'compact'}
              icon={getEmptyStateMessage.icon}
              title={getEmptyStateMessage.title}
              description={getEmptyStateMessage.description}
              variant={getEmptyStateMessage.variant}
              action={
                getEmptyStateMessage.action
                  ? getEmptyStateMessage.action
                  : activeFiltersCount > 0 || search
                    ? {
                        label: i18nT('travel:components.listTravel.RightColumn.sbrosit_usloviya_60d7d2cf'),
                        onPress: () => {
                          onClearAll?.();
                          setSearch?.('');
                        },
                      }
                    : undefined
              }
              suggestions={getEmptyStateMessage.suggestions}
            />
          </View>
        )}
    </>
  )
}

export default memo(RightColumnListStatus)
