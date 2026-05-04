/**
 * Skeleton loaders для компонентов страницы деталей путешествия
 * Улучшают воспринимаемую производительность вместо пустых экранов
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import ReservedSpace from '@/components/ui/ReservedSpace';

/**
 * Skeleton для текстового описания
 */
export const DescriptionSkeleton: React.FC = () => {
  const colors = useThemedColors();
  const lineH = 18;
  const lines = 8;
  const gap = 8;
  const reservedH = lines * lineH + Math.max(0, lines - 1) * gap;

  const styles = useMemo(() => StyleSheet.create({
    descriptionContainer: {
      padding: DESIGN_TOKENS.spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      width: '100%',
    },
  }), [colors.surface]);

  return (
    <View style={styles.descriptionContainer}>
      <ReservedSpace testID="travel-details-description-reserved" height={reservedH} />
    </View>
  );
};

export const QuickFactsSkeleton: React.FC = () => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
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
  }), [])

  return (
    <View style={styles.container}>
      <View style={styles.chipsRow}>
        <SkeletonLoader width={140} height={40} borderRadius={DESIGN_TOKENS.radii.sm} />
        <SkeletonLoader width={120} height={40} borderRadius={DESIGN_TOKENS.radii.sm} />
        <SkeletonLoader width={132} height={40} borderRadius={DESIGN_TOKENS.radii.sm} />
      </View>
      <View style={styles.categoriesRow}>
        <SkeletonLoader width={84} height={18} borderRadius={6} />
        <SkeletonLoader width={92} height={32} borderRadius={DESIGN_TOKENS.radii.sm} />
        <SkeletonLoader width={108} height={32} borderRadius={DESIGN_TOKENS.radii.sm} />
      </View>
    </View>
  )
}

export const QuickJumpSkeleton: React.FC = () => {
  const styles = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
      width: '100%',
    },
  }), [])

  return (
    <View style={styles.row}>
      <SkeletonLoader width={148} height={38} borderRadius={DESIGN_TOKENS.radii.sm} />
      <SkeletonLoader width={116} height={38} borderRadius={DESIGN_TOKENS.radii.sm} />
      <SkeletonLoader width={138} height={38} borderRadius={DESIGN_TOKENS.radii.sm} />
    </View>
  )
}

/**
 * Skeleton для карты
 */
export const MapSkeleton: React.FC = () => {
  return (
    <View style={{ width: '100%', marginBottom: DESIGN_TOKENS.spacing.lg }}>
      <SkeletonLoader width="100%" height={400} borderRadius={DESIGN_TOKENS.radii.md} />
    </View>
  );
};

export const MapSectionSkeleton: React.FC = () => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      gap: DESIGN_TOKENS.spacing.md,
    },
  }), [])

  return (
    <View style={styles.container}>
      <SkeletonLoader width={190} height={28} borderRadius={8} />
      <MapSkeleton />
      <PointListSkeleton />
    </View>
  )
}

/**
 * Skeleton для списка точек маршрута
 */
export const PointListSkeleton: React.FC = () => {
  const colors = useThemedColors();

  const styles = useMemo(() => StyleSheet.create({
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
    pointContent: {
      paddingTop: 8,
    },
    marginBottom: {
      marginBottom: 8,
    },
  }), [colors.surface]);

  return (
    <View style={styles.pointListContainer}>
      {Array.from({ length: 3 }).map((_, index) => (
        <View key={index} style={styles.pointCard}>
          <SkeletonLoader width="100%" height={200} borderRadius={DESIGN_TOKENS.radii.md} style={styles.marginBottom} />
          <View style={styles.pointContent}>
            <SkeletonLoader width="80%" height={18} borderRadius={4} style={styles.marginBottom} />
            <SkeletonLoader width="60%" height={14} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton для списка похожих путешествий
 */
export const TravelListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  const colors = useThemedColors();

  const styles = useMemo(() => StyleSheet.create({
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
    marginBottom: {
      marginBottom: 8,
    },
  }), [colors.surface]);

  return (
    <View style={styles.travelListContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.travelCard}>
          <SkeletonLoader width="100%" height={160} borderRadius={DESIGN_TOKENS.radii.md} style={styles.marginBottom} />
          <SkeletonLoader width="85%" height={18} borderRadius={4} style={styles.marginBottom} />
          <SkeletonLoader width="60%" height={14} borderRadius={4} />
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton для видео YouTube
 */
export const VideoSkeleton: React.FC = () => {
  return (
    <View style={{ width: '100%', marginBottom: DESIGN_TOKENS.spacing.lg }}>
      <SkeletonLoader width="100%" height={400} borderRadius={DESIGN_TOKENS.radii.md} />
    </View>
  );
};

/**
 * Skeleton для комментариев (P2-8)
 */
export const CommentsSkeleton: React.FC = () => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      padding: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.md,
    },
    commentRow: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    textBlock: {
      flex: 1,
      gap: 6,
    },
  }), []);

  return (
    <View style={styles.container}>
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} style={styles.commentRow}>
          <SkeletonLoader width={36} height={36} borderRadius={18} />
          <View style={styles.textBlock}>
            <SkeletonLoader width="40%" height={14} borderRadius={4} />
            <SkeletonLoader width="90%" height={14} borderRadius={4} />
            <SkeletonLoader width="65%" height={14} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
};

export const AuthorSectionSkeleton: React.FC = () => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      gap: DESIGN_TOKENS.spacing.md,
    },
    card: {
      width: '100%',
      padding: DESIGN_TOKENS.spacing.lg,
      borderRadius: DESIGN_TOKENS.radii.md,
      gap: DESIGN_TOKENS.spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.md,
    },
    meta: {
      flex: 1,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    buttons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
    },
  }), [])

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <SkeletonLoader width={120} height={24} borderRadius={8} />
        <SkeletonLoader width="72%" height={18} borderRadius={6} />
        <View style={styles.row}>
          <SkeletonLoader width={72} height={72} borderRadius={36} />
          <View style={styles.meta}>
            <SkeletonLoader width="56%" height={18} borderRadius={6} />
            <SkeletonLoader width="42%" height={16} borderRadius={6} />
            <SkeletonLoader width="78%" height={16} borderRadius={6} />
          </View>
        </View>
      </View>

      <View style={styles.buttons}>
        <SkeletonLoader width={156} height={44} borderRadius={DESIGN_TOKENS.radii.pill} />
        <SkeletonLoader width={188} height={44} borderRadius={DESIGN_TOKENS.radii.pill} />
      </View>
    </View>
  )
}

export const RatingSectionSkeleton: React.FC = () => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      padding: DESIGN_TOKENS.spacing.lg,
      borderRadius: DESIGN_TOKENS.radii.md,
      gap: DESIGN_TOKENS.spacing.md,
    },
    row: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.md,
      flexWrap: 'wrap',
    },
    box: {
      flex: 1,
      minWidth: 220,
      gap: DESIGN_TOKENS.spacing.sm,
    },
  }), [])

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <SkeletonLoader width={120} height={24} borderRadius={8} />
        <SkeletonLoader width={92} height={18} borderRadius={6} />
      </View>
      <View style={styles.row}>
        <View style={styles.box}>
          <SkeletonLoader width="48%" height={18} borderRadius={6} />
          <SkeletonLoader width={180} height={28} borderRadius={8} />
          <SkeletonLoader width="32%" height={16} borderRadius={6} />
        </View>
        <View style={styles.box}>
          <SkeletonLoader width="56%" height={18} borderRadius={6} />
          <SkeletonLoader width={180} height={28} borderRadius={8} />
          <SkeletonLoader width="44%" height={16} borderRadius={6} />
        </View>
      </View>
    </View>
  )
}

export const SidebarSectionSkeleton: React.FC = () => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      gap: DESIGN_TOKENS.spacing.xl,
    },
    section: {
      width: '100%',
      gap: DESIGN_TOKENS.spacing.sm,
    },
  }), [])

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <SkeletonLoader width={220} height={26} borderRadius={8} />
        <SkeletonLoader width="52%" height={18} borderRadius={6} />
        <TravelListSkeleton count={2} />
      </View>
      <View style={styles.section}>
        <SkeletonLoader width={210} height={26} borderRadius={8} />
        <SkeletonLoader width="58%" height={18} borderRadius={6} />
        <TravelListSkeleton count={2} />
      </View>
    </View>
  )
}

export const FooterSectionSkeleton: React.FC<{ isMobile?: boolean }> = ({ isMobile = false }) => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      gap: DESIGN_TOKENS.spacing.lg,
    },
    section: {
      width: '100%',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    buttonRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
    },
  }), [])

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <SkeletonLoader width={220} height={24} borderRadius={8} />
        <SkeletonLoader width="70%" height={18} borderRadius={6} />
        <SkeletonLoader width={260} height={44} borderRadius={DESIGN_TOKENS.radii.pill} />
      </View>

      {!isMobile && (
        <View style={styles.section}>
          <SkeletonLoader width={180} height={24} borderRadius={8} />
          <View style={styles.buttonRow}>
            <SkeletonLoader width={160} height={44} borderRadius={DESIGN_TOKENS.radii.pill} />
            <SkeletonLoader width={140} height={44} borderRadius={DESIGN_TOKENS.radii.pill} />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <SkeletonLoader width={210} height={24} borderRadius={8} />
        <SkeletonLoader width="76%" height={18} borderRadius={6} />
        <SkeletonLoader width={220} height={44} borderRadius={DESIGN_TOKENS.radii.pill} />
      </View>
    </View>
  )
}

/**
 * Универсальный skeleton для секций
 */
export const SectionSkeleton: React.FC<{ lines?: number }> = ({ lines = 4 }) => {
  const colors = useThemedColors();
  const lineH = 18;
  const gap = 8;
  const reservedH = lines * lineH + Math.max(0, lines - 1) * gap;

  const styles = useMemo(() => StyleSheet.create({
    sectionContainer: {
      padding: DESIGN_TOKENS.spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      width: '100%',
    },
  }), [colors.surface]);

  return (
    <View style={styles.sectionContainer}>
      <ReservedSpace testID="travel-details-section-reserved" height={reservedH} />
    </View>
  );
};
