import React, { memo, useState } from 'react'
import { Platform, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { TravelEngagementStats } from '@/utils/travelEngagementStats'

const ENGAGEMENT_ICON_SIZE = 14
const IS_WEB = Platform.OS === 'web' || typeof document !== 'undefined'

const ENGAGEMENT_METRICS: Array<{
  key: keyof TravelEngagementStats
  label: string
  icon: React.ComponentProps<typeof Feather>['name']
}> = [
  { key: 'favoritesCount', label: 'Сохранили', icon: 'heart' },
  { key: 'wishlistCount', label: 'Хочу', icon: 'bookmark' },
  { key: 'visitedCount', label: 'Были', icon: 'check-circle' },
  { key: 'plannedCount', label: 'Планируют', icon: 'calendar' },
]

type Props = {
  engagementStats?: TravelEngagementStats | null
  styles: any
  iconColor: string
}

// Hover-состояние тултипа живёт здесь, а не в родительском TravelListItem,
// чтобы наведение на метрику не ре-рендерило всю карточку с изображением.
function TravelListItemEngagementMetrics({ engagementStats, styles, iconColor }: Props) {
  const [hoveredMetric, setHoveredMetric] = useState<keyof TravelEngagementStats | null>(null)

  return (
    <View style={styles.engagementMetricsRow}>
      {ENGAGEMENT_METRICS.map((metric) => {
        const value = engagementStats?.[metric.key] ?? 0
        const tooltip = `${metric.label}: ${value}`

        return (
          <View
            key={metric.key}
            style={styles.engagementMetric}
            accessibilityLabel={tooltip}
            {...(IS_WEB
              ? ({
                  onMouseEnter: () => setHoveredMetric(metric.key),
                  onMouseLeave: () => setHoveredMetric(null),
                  onFocus: () => setHoveredMetric(metric.key),
                  onBlur: () => setHoveredMetric(null),
                } as any)
              : null)}
          >
            <Feather name={metric.icon} size={ENGAGEMENT_ICON_SIZE} color={iconColor} />
            <Text style={styles.engagementMetricText}>{value}</Text>
            {IS_WEB && hoveredMetric === metric.key ? (
              <View style={styles.engagementTooltip}>
                <Text style={styles.engagementTooltipText}>{tooltip}</Text>
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

export default memo(TravelListItemEngagementMetrics)
