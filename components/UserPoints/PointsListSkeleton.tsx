import React from 'react'
import { StyleSheet, View } from 'react-native'

import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'

import { PHONE_LIST_IMAGE_HEIGHT } from './PointCard'

/**
 * Каркас карточек точки на время первой загрузки списка (#3133): до этого
 * панель оставалась пустой, а вкладка показывала «Список (0)», будто точек
 * нет. Геометрия повторяет компактную карточку: фото-полоса, пилюля
 * категории, две строки названия, адрес и ряд действий.
 */
export const POINTS_LIST_SKELETON_COUNT = 4
/** Высота фото каркаса на широком экране — середина диапазона карточки 128–188 px. */
export const WIDE_LIST_SKELETON_IMAGE_HEIGHT = 160

type Props = {
  count?: number
  imageHeight?: number
  testID?: string
}

/**
 * Один каркас карточки — им же рисуется карточка, чья полная запись ещё не
 * пришла окном `ids=` (#3161, `useUserPointDetail`).
 */
export const PointSkeletonCard: React.FC<{ imageHeight?: number; width?: number; testID?: string }> = ({
  imageHeight = PHONE_LIST_IMAGE_HEIGHT,
  width,
  testID,
}) => {
  const colors = useThemedColors()
  const styles = React.useMemo(() => createStyles(colors), [colors])
  return (
    <View
      style={[styles.card, width ? { width } : null]}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SkeletonLoader height={imageHeight} borderRadius={DESIGN_TOKENS.radii.md} />
      <View style={styles.body}>
        <SkeletonLoader width={88} height={18} borderRadius={DESIGN_TOKENS.radii.full} />
        <SkeletonLoader width="78%" height={16} />
        <SkeletonLoader width="54%" height={16} />
        <SkeletonLoader width="92%" height={14} />
        <View style={styles.actions}>
          {Array.from({ length: 4 }, (_, action) => (
            <SkeletonLoader key={action} width={44} height={44} borderRadius={DESIGN_TOKENS.radii.full} />
          ))}
        </View>
      </View>
    </View>
  )
}

export const PointsListSkeleton: React.FC<Props> = ({
  count = POINTS_LIST_SKELETON_COUNT,
  imageHeight = PHONE_LIST_IMAGE_HEIGHT,
  testID = 'userpoints-list-skeleton',
}) => (
  <View testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {Array.from({ length: count }, (_, index) => (
      <PointSkeletonCard key={index} imageHeight={imageHeight} />
    ))}
  </View>
)

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      marginBottom: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight ?? colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    body: {
      padding: DESIGN_TOKENS.spacing.sm,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: DESIGN_TOKENS.spacing.xs,
    },
  })

export default PointsListSkeleton
