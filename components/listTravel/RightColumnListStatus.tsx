import React, { memo } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'

import EmptyState from '@/components/ui/EmptyState'
import { RecommendationsPlaceholder } from '@/components/listTravel/RightColumn.parts'
import type { RightColumnProps } from '@/components/listTravel/RightColumn'
import TravelListItemSkeleton from '@/components/listTravel/TravelListItemSkeleton'
import type { useRightColumnStyles } from '@/components/listTravel/useRightColumnStyles'
import { translate as i18nT } from '@/i18n'

/**
 * #2179: состояние списка до результатов — скелетон, сбой, пустая выдача.
 * Рисуется как `ListEmptyComponent` того же FlashList, что и карточки: у
 * каталога один владелец прокрутки во всех фазах, поэтому SEO-интро в шапке
 * списка не теряет позицию, когда приходят результаты. Горизонтальный отступ
 * и верхний зазор даёт контейнер содержимого списка, как и рядам карточек.
 *
 * #2253: каркас стоит в рядах карточек — те же `rowLayout` (ряд, ячейка,
 * разделитель рядов), ячейка — `TravelListItemSkeleton` из стилей карточки.
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
  rowLayout: ReturnType<typeof useRightColumnStyles>['rowLayout']
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
  rowLayout,
}: RightColumnListStatusProps) {
  const { cols, rowStyle, firstRowStyle, rowSeparatorStyle, itemWrapperStyle } = rowLayout
  const skeletonRowCount = Math.ceil(initialSkeletonCount / cols)

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
      {shouldShowSkeleton &&
        Array.from({ length: skeletonRowCount }).map((_, rowIndex) => (
          <React.Fragment key={`travel-skeleton-row-${rowIndex}`}>
            {rowSeparatorStyle && rowIndex > 0 ? <View style={rowSeparatorStyle} /> : null}
            <View style={rowIndex === 0 ? firstRowStyle : rowStyle}>
              {Array.from({ length: cols }).map((__, itemIndex) => (
                <View key={`slot-${itemIndex}`} style={itemWrapperStyle}>
                  <TravelListItemSkeleton />
                </View>
              ))}
            </View>
          </React.Fragment>
        ))}

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
