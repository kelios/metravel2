import { memo, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useThemedColors } from '@/hooks/useTheme'

import { CARD_MEDIA_SLOT_RATIO } from './travelListItemHelpers'
import {
  TRAVEL_CARD_META_LINE_HEIGHT,
  TRAVEL_CARD_TITLE_MIN_HEIGHT,
  createTravelListItemStyles,
} from './travelListItemStyles'

type Props = {
  testID?: string
}

/**
 * Каркас карточки маршрута до прихода данных (#2176).
 *
 * Занимает место настоящей `TravelListItem`: рамка, отступы и строки текста —
 * из тех же стилей, медиа-слот — тот же квадрат `CARD_MEDIA_SLOT_RATIO`. Каркас,
 * собранный из своих чисел, расходился с карточкой, и список под шапкой прыгал
 * в момент ответа API (профиль, прод 05.10.2026: 16 px, CLS 0,029 на 390).
 */
function TravelListItemSkeleton({ testID = 'travel-list-item-skeleton' }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createTravelListItemStyles(colors), [colors])

  return (
    <View style={styles.card} testID={testID} aria-hidden>
      <View style={skeletonStyles.media}>
        {/* Плашка позиционирована абсолютно: высота слота приходит из
            aspect-ratio, а процент от такой высоты у потомка в потоке считается
            не во всех браузерах. */}
        <SkeletonLoader width="100%" height="100%" borderRadius={0} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.cardContentContainer}>
        <View style={styles.contentStack}>
          <View style={skeletonStyles.title}>
            <SkeletonLoader width="78%" height={14} borderRadius={4} />
            <SkeletonLoader width="52%" height={14} borderRadius={4} />
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaBadgesRow}>
              <View style={skeletonStyles.metaLine}>
                <SkeletonLoader width={96} height={12} borderRadius={4} />
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

const skeletonStyles = StyleSheet.create({
  media: {
    width: '100%',
    aspectRatio: CARD_MEDIA_SLOT_RATIO,
    overflow: 'hidden',
  },
  // Две строки заголовка: карточка резервирует их, даже когда название короткое.
  title: {
    height: TRAVEL_CARD_TITLE_MIN_HEIGHT,
    justifyContent: 'space-evenly',
  },
  metaLine: {
    height: TRAVEL_CARD_META_LINE_HEIGHT,
    justifyContent: 'center',
  },
})

export default memo(TravelListItemSkeleton)
