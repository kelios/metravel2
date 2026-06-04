import React from 'react'
import { ScrollView, Text as RNText } from 'react-native'

import type { PointsListStyles } from './types'

const INITIAL_POINTS = 80
const POINTS_INCREMENT = 80
const END_REACHED_THRESHOLD = 360

type Props = {
  filteredPoints: any[]
  isLoading: boolean
  listKey?: string
  localStyles: PointsListStyles
  renderEmpty: () => React.ReactElement
  renderListHeader: () => React.ReactElement
  renderPointListItem: ({ item }: { item: any }) => React.ReactElement
}

export const PointsListWebLazyScroll: React.FC<Props> = ({
  filteredPoints,
  isLoading,
  listKey,
  localStyles,
  renderEmpty,
  renderListHeader,
  renderPointListItem,
}) => {
  const [visibleCount, setVisibleCount] = React.useState(INITIAL_POINTS)
  const visiblePoints = React.useMemo(
    () => filteredPoints.slice(0, visibleCount),
    [filteredPoints, visibleCount]
  )
  const hasMoreItems = visibleCount < filteredPoints.length

  React.useEffect(() => {
    setVisibleCount(INITIAL_POINTS)
  }, [filteredPoints])

  const loadMoreItems = React.useCallback(() => {
    setVisibleCount((current) => Math.min(current + POINTS_INCREMENT, filteredPoints.length))
  }, [filteredPoints.length])

  const handleScroll = React.useCallback(
    (event: any) => {
      if (!hasMoreItems) return
      const nativeEvent = event?.nativeEvent
      const layoutHeight = Number(nativeEvent?.layoutMeasurement?.height ?? 0)
      const contentHeight = Number(nativeEvent?.contentSize?.height ?? 0)
      const offsetY = Number(nativeEvent?.contentOffset?.y ?? 0)
      if (!Number.isFinite(layoutHeight) || !Number.isFinite(contentHeight) || !Number.isFinite(offsetY)) return
      if (offsetY + layoutHeight >= contentHeight - END_REACHED_THRESHOLD) {
        loadMoreItems()
      }
    },
    [hasMoreItems, loadMoreItems]
  )

  return (
    <ScrollView
      key={listKey ?? 'userpoints-list'}
      style={localStyles.rightPanelScroll}
      contentContainerStyle={[localStyles.rightPanelContent, localStyles.pointsList] as any}
      testID="userpoints-panel-content-list"
      showsVerticalScrollIndicator={true}
      onScroll={handleScroll}
      scrollEventThrottle={32}
    >
      {renderListHeader()}
      {filteredPoints.length === 0 && !isLoading ? renderEmpty() : null}
      {visiblePoints.map((item: any, index: number) => (
        <React.Fragment key={String(item?.id ?? `idx-${index}`)}>
          {renderPointListItem({ item })}
        </React.Fragment>
      ))}
      {hasMoreItems ? (
        <RNText style={localStyles.listProgressText}>
          Показано {visiblePoints.length} из {filteredPoints.length}
        </RNText>
      ) : null}
    </ScrollView>
  )
}
