import React from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'

import { PLACE_LIST_ROW_HEIGHT, PLACE_LIST_ROW_THUMB_SIZE } from '@/components/places/PlaceListRow'

/**
 * Каркас карточек точки на время первой загрузки списка (#3133): до этого
 * панель оставалась пустой, а вкладка показывала «Список (0)», будто точек
 * нет. Геометрия повторяет компактную карточку: фото-полоса, пилюля
 * категории, две строки названия, адрес и ряд действий.
 */
export const POINTS_LIST_SKELETON_COUNT = 4
/** Высота фото каркаса на широком экране — середина диапазона карточки 128–188 px. */
export const WIDE_LIST_SKELETON_IMAGE_HEIGHT = 160

/** Каркасов строк на телефоне: экран 844 px вмещает шесть строк (#3142). */
export const POINTS_LIST_ROW_SKELETON_COUNT = 6

type Props = {
  count?: number
  imageHeight?: number
  /** `row` — каркас компактной строки телефона (#3142), `card` — карточки. */
  variant?: 'card' | 'row'
  testID?: string
}

/**
 * Один каркас карточки — им же рисуется карточка, чья полная запись ещё не
 * пришла окном `ids=` (#3161, `useUserPointDetail`).
 */
export const PointSkeletonCard: React.FC<{ imageHeight?: number; width?: number; style?: StyleProp<ViewStyle>; testID?: string }> = ({
  imageHeight = WIDE_LIST_SKELETON_IMAGE_HEIGHT,
  width,
  style,
  testID,
}) => {
  const colors = useThemedColors()
  const styles = React.useMemo(() => createStyles(colors), [colors])
  return (
    <View
      style={[styles.card, width ? { width } : null, style]}
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

/** Каркас компактной строки точки: та же высота и миниатюра, что у `PlaceListRow` (#2253). */
export const PointSkeletonRow: React.FC<{ style?: StyleProp<ViewStyle>; testID?: string }> = ({ style, testID }) => {
  const colors = useThemedColors()
  const styles = React.useMemo(() => createStyles(colors), [colors])
  return (
    <View style={[styles.row, style]} testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SkeletonLoader width={PLACE_LIST_ROW_THUMB_SIZE} height={PLACE_LIST_ROW_THUMB_SIZE} borderRadius={DESIGN_TOKENS.radii.sm} />
      <View style={styles.rowBody}>
        <SkeletonLoader width={64} height={12} borderRadius={DESIGN_TOKENS.radii.full} />
        <SkeletonLoader width="82%" height={16} />
        <SkeletonLoader width="58%" height={14} />
      </View>
    </View>
  )
}

// Шаг строк каркаса = шаг ячеек списка (`pointsListItem.marginBottom`): каркас
// пина в ячейке своего отступа не несёт, иначе при гидратации строка прыгает.
const rowListGap: ViewStyle = { marginBottom: DESIGN_TOKENS.spacing.sm }
const cardListGap: ViewStyle = { marginBottom: DESIGN_TOKENS.spacing.md }

export const PointsListSkeleton: React.FC<Props> = ({
  count,
  variant = 'card',
  imageHeight = WIDE_LIST_SKELETON_IMAGE_HEIGHT,
  testID = 'userpoints-list-skeleton',
}) => (
  <View testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {Array.from({ length: count ?? (variant === 'row' ? POINTS_LIST_ROW_SKELETON_COUNT : POINTS_LIST_SKELETON_COUNT) }, (_, index) =>
      variant === 'row' ? <PointSkeletonRow key={index} style={rowListGap} /> : <PointSkeletonCard key={index} imageHeight={imageHeight} style={cardListGap} />,
    )}
  </View>
)

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    // Без своего отступа: в ячейке списка каркас карточки заменяется карточкой,
    // шаг даёт сама ячейка (#2253); в полном каркасе — `cardListGap`.
    card: {
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      minHeight: PLACE_LIST_ROW_HEIGHT,
      padding: DESIGN_TOKENS.spacing.xs,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight ?? colors.border,
      backgroundColor: colors.surface,
    },
    rowBody: {
      flex: 1,
      gap: DESIGN_TOKENS.spacing.xxs,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: DESIGN_TOKENS.spacing.xs,
    },
  })

export default PointsListSkeleton
