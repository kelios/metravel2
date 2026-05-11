import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import ReservedSpace from '@/components/ui/ReservedSpace'

const LINE_HEIGHT = 18
const LINE_GAP = 8

function reservedHeight(lines: number) {
  return lines * LINE_HEIGHT + Math.max(0, lines - 1) * LINE_GAP
}

const themedCardStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      padding: DESIGN_TOKENS.spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      width: '100%',
    },
    pointListContainer: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.md,
    },
    pointCard: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      padding: DESIGN_TOKENS.spacing.md,
      marginBottom: 12,
    },
    pointContent: { paddingTop: 8 },
    travelListContainer: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.md,
    },
    travelCard: {
      width: '100%',
      maxWidth: 300,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      padding: DESIGN_TOKENS.spacing.md,
      marginBottom: 12,
    },
  })

const staticStyles = StyleSheet.create({
  fullWidthBlock: { width: '100%', marginBottom: DESIGN_TOKENS.spacing.lg },
  spacedBottom: { marginBottom: 8 },
  quickFactsContainer: {
    width: '100%',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
    alignItems: 'center',
  },
  quickJumpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
    width: '100%',
  },
  mapSectionContainer: { width: '100%', gap: DESIGN_TOKENS.spacing.md },
  commentsContainer: {
    padding: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.md,
  },
  commentRow: { flexDirection: 'row', gap: DESIGN_TOKENS.spacing.sm },
  commentTextBlock: { flex: 1, gap: 6 },
  authorContainer: { width: '100%', gap: DESIGN_TOKENS.spacing.md },
  authorCard: {
    width: '100%',
    padding: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.radii.md,
    gap: DESIGN_TOKENS.spacing.md,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.md,
  },
  authorMeta: { flex: 1, gap: DESIGN_TOKENS.spacing.xs },
  authorButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  ratingContainer: {
    width: '100%',
    padding: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.radii.md,
    gap: DESIGN_TOKENS.spacing.md,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.md,
    flexWrap: 'wrap',
  },
  ratingBox: { flex: 1, minWidth: 220, gap: DESIGN_TOKENS.spacing.sm },
  sidebarContainer: { width: '100%', gap: DESIGN_TOKENS.spacing.xl },
  sidebarSection: { width: '100%', gap: DESIGN_TOKENS.spacing.sm },
  footerContainer: { width: '100%', gap: DESIGN_TOKENS.spacing.lg },
  footerSection: { width: '100%', gap: DESIGN_TOKENS.spacing.sm },
  footerButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
  },
})

const QUICK_JUMP_CHIP_WIDTHS = [148, 116, 138, 132, 124]

function useThemedCardStyles() {
  const colors = useThemedColors()
  return useMemo(() => themedCardStyles(colors), [colors])
}

export const DescriptionSkeleton: React.FC = () => {
  const styles = useThemedCardStyles()
  return (
    <View style={styles.container}>
      <ReservedSpace testID="travel-details-description-reserved" height={reservedHeight(8)} />
    </View>
  )
}

export const SectionSkeleton: React.FC<{ lines?: number }> = ({ lines = 4 }) => {
  const styles = useThemedCardStyles()
  return (
    <View style={styles.container}>
      <ReservedSpace testID="travel-details-section-reserved" height={reservedHeight(lines)} />
    </View>
  )
}

export const QuickFactsSkeleton: React.FC = () => (
  <View style={staticStyles.quickFactsContainer}>
    <View style={staticStyles.chipsRow}>
      <SkeletonLoader width={140} height={40} borderRadius={DESIGN_TOKENS.radii.sm} />
      <SkeletonLoader width={120} height={40} borderRadius={DESIGN_TOKENS.radii.sm} />
      <SkeletonLoader width={132} height={40} borderRadius={DESIGN_TOKENS.radii.sm} />
    </View>
    <View style={staticStyles.categoriesRow}>
      <SkeletonLoader width={84} height={18} borderRadius={6} />
      <SkeletonLoader width={92} height={32} borderRadius={DESIGN_TOKENS.radii.sm} />
      <SkeletonLoader width={108} height={32} borderRadius={DESIGN_TOKENS.radii.sm} />
    </View>
  </View>
)

export const QuickJumpSkeleton: React.FC<{ chipCount?: number }> = ({ chipCount = 3 }) => {
  const widths = useMemo(
    () =>
      Array.from({ length: Math.max(0, chipCount) }, (_, i) =>
        QUICK_JUMP_CHIP_WIDTHS[i % QUICK_JUMP_CHIP_WIDTHS.length],
      ),
    [chipCount],
  )
  return (
    <View style={staticStyles.quickJumpRow}>
      {widths.map((w, i) => (
        <SkeletonLoader
          key={i}
          width={w}
          height={38}
          borderRadius={DESIGN_TOKENS.radii.sm}
        />
      ))}
    </View>
  )
}

const MediaPlaceholderSkeleton: React.FC = () => (
  <View style={staticStyles.fullWidthBlock}>
    <SkeletonLoader width="100%" height={400} borderRadius={DESIGN_TOKENS.radii.md} />
  </View>
)

export const MapSkeleton = MediaPlaceholderSkeleton
export const VideoSkeleton = MediaPlaceholderSkeleton

export const MapSectionSkeleton: React.FC = () => (
  <View style={staticStyles.mapSectionContainer}>
    <SkeletonLoader width={190} height={28} borderRadius={8} />
    <MapSkeleton />
    <PointListSkeleton />
  </View>
)

export const PointListSkeleton: React.FC = () => {
  const styles = useThemedCardStyles()
  return (
    <View style={styles.pointListContainer}>
      {Array.from({ length: 3 }, (_, i) => (
        <View key={i} style={styles.pointCard}>
          <SkeletonLoader
            width="100%"
            height={200}
            borderRadius={DESIGN_TOKENS.radii.md}
            style={staticStyles.spacedBottom}
          />
          <View style={styles.pointContent}>
            <SkeletonLoader
              width="80%"
              height={18}
              borderRadius={4}
              style={staticStyles.spacedBottom}
            />
            <SkeletonLoader width="60%" height={14} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  )
}

export const TravelListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  const styles = useThemedCardStyles()
  return (
    <View style={styles.travelListContainer}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.travelCard}>
          <SkeletonLoader
            width="100%"
            height={160}
            borderRadius={DESIGN_TOKENS.radii.md}
            style={staticStyles.spacedBottom}
          />
          <SkeletonLoader
            width="85%"
            height={18}
            borderRadius={4}
            style={staticStyles.spacedBottom}
          />
          <SkeletonLoader width="60%" height={14} borderRadius={4} />
        </View>
      ))}
    </View>
  )
}

export const CommentsSkeleton: React.FC = () => (
  <View style={staticStyles.commentsContainer}>
    {Array.from({ length: 3 }, (_, i) => (
      <View key={i} style={staticStyles.commentRow}>
        <SkeletonLoader width={36} height={36} borderRadius={18} />
        <View style={staticStyles.commentTextBlock}>
          <SkeletonLoader width="40%" height={14} borderRadius={4} />
          <SkeletonLoader width="90%" height={14} borderRadius={4} />
          <SkeletonLoader width="65%" height={14} borderRadius={4} />
        </View>
      </View>
    ))}
  </View>
)

export const AuthorSectionSkeleton: React.FC = () => (
  <View style={staticStyles.authorContainer}>
    <View style={staticStyles.authorCard}>
      <SkeletonLoader width={120} height={24} borderRadius={8} />
      <SkeletonLoader width="72%" height={18} borderRadius={6} />
      <View style={staticStyles.authorRow}>
        <SkeletonLoader width={72} height={72} borderRadius={36} />
        <View style={staticStyles.authorMeta}>
          <SkeletonLoader width="56%" height={18} borderRadius={6} />
          <SkeletonLoader width="42%" height={16} borderRadius={6} />
          <SkeletonLoader width="78%" height={16} borderRadius={6} />
        </View>
      </View>
    </View>
    <View style={staticStyles.authorButtons}>
      <SkeletonLoader width={156} height={44} borderRadius={DESIGN_TOKENS.radii.pill} />
      <SkeletonLoader width={188} height={44} borderRadius={DESIGN_TOKENS.radii.pill} />
    </View>
  </View>
)

export const RatingSectionSkeleton: React.FC = () => (
  <View style={staticStyles.ratingContainer}>
    <View style={staticStyles.ratingRow}>
      <SkeletonLoader width={120} height={24} borderRadius={8} />
      <SkeletonLoader width={92} height={18} borderRadius={6} />
    </View>
    <View style={staticStyles.ratingRow}>
      <View style={staticStyles.ratingBox}>
        <SkeletonLoader width="48%" height={18} borderRadius={6} />
        <SkeletonLoader width={180} height={28} borderRadius={8} />
        <SkeletonLoader width="32%" height={16} borderRadius={6} />
      </View>
      <View style={staticStyles.ratingBox}>
        <SkeletonLoader width="56%" height={18} borderRadius={6} />
        <SkeletonLoader width={180} height={28} borderRadius={8} />
        <SkeletonLoader width="44%" height={16} borderRadius={6} />
      </View>
    </View>
  </View>
)

export const SidebarSectionSkeleton: React.FC = () => (
  <View style={staticStyles.sidebarContainer}>
    <View style={staticStyles.sidebarSection}>
      <SkeletonLoader width={220} height={26} borderRadius={8} />
      <SkeletonLoader width="52%" height={18} borderRadius={6} />
      <TravelListSkeleton count={2} />
    </View>
    <View style={staticStyles.sidebarSection}>
      <SkeletonLoader width={210} height={26} borderRadius={8} />
      <SkeletonLoader width="58%" height={18} borderRadius={6} />
      <TravelListSkeleton count={2} />
    </View>
  </View>
)

export const FooterSectionSkeleton: React.FC<{ isMobile?: boolean }> = ({
  isMobile = false,
}) => (
  <View style={staticStyles.footerContainer}>
    <View style={staticStyles.footerSection}>
      <SkeletonLoader width={220} height={24} borderRadius={8} />
      <SkeletonLoader width="70%" height={18} borderRadius={6} />
      <SkeletonLoader width={260} height={44} borderRadius={DESIGN_TOKENS.radii.pill} />
    </View>

    {!isMobile && (
      <View style={staticStyles.footerSection}>
        <SkeletonLoader width={180} height={24} borderRadius={8} />
        <View style={staticStyles.footerButtonRow}>
          <SkeletonLoader width={160} height={44} borderRadius={DESIGN_TOKENS.radii.pill} />
          <SkeletonLoader width={140} height={44} borderRadius={DESIGN_TOKENS.radii.pill} />
        </View>
      </View>
    )}

    <View style={staticStyles.footerSection}>
      <SkeletonLoader width={210} height={24} borderRadius={8} />
      <SkeletonLoader width="76%" height={18} borderRadius={6} />
      <SkeletonLoader width={220} height={44} borderRadius={DESIGN_TOKENS.radii.pill} />
    </View>
  </View>
)
