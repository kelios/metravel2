/**
 * HomePageSkeleton - YouTube-style instant skeleton for home/travels page
 * 
 * Key features:
 * - Renders instantly on first paint (no delays)
 * - Web navigation sections remain accessible during loading
 * - Shimmer animation for visual feedback
 * - Responsive layout matching actual content
 * - No layout shifts during transition
 */
import React, { memo, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Platform, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';

/** Navigation sections for web sidebar during loading */
const NAV_SECTIONS = [
  { key: 'hero', title: 'Главная', icon: 'home' },
  { key: 'random', title: 'Случайные маршруты', icon: 'shuffle' },
  { key: 'howItWorks', title: 'Как это работает', icon: 'info' },
  { key: 'weekend', title: 'На выходные', icon: 'calendar' },
  { key: 'inspiration', title: 'Вдохновение', icon: 'compass' },
  { key: 'faq', title: 'Вопросы и ответы', icon: 'help-circle' },
] as const;

interface SidebarNavSkeletonProps {
  colors: ReturnType<typeof useThemedColors>;
  showNavigation?: boolean;
  onSectionPress?: (sectionKey: string) => void;
}

/** Sidebar navigation skeleton for web */
const SidebarNavSkeleton = memo<SidebarNavSkeletonProps>(({ colors, showNavigation = true, onSectionPress }) => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: 280,
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingTop: DESIGN_TOKENS.spacing.xl,
      paddingBottom: DESIGN_TOKENS.spacing.lg,
    },
    header: {
      marginBottom: DESIGN_TOKENS.spacing.lg,
    },
    headerTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.text,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      marginBottom: DESIGN_TOKENS.spacing.xs,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    navItemHover: Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
      } as any,
      default: {},
    }),
    navIcon: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navTitle: {
      flex: 1,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textSecondary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginVertical: DESIGN_TOKENS.spacing.md,
    },
    skeletonRow: {
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
  }), [colors]);

  if (!showNavigation) {
    return (
      <View style={styles.container}>
        <SkeletonLoader width="60%" height={24} borderRadius={8} />
        <View style={styles.divider} />
        {Array.from({ length: 6 }).map((_, index) => (
          <View key={`nav-skeleton-${index}`} style={styles.skeletonRow}>
            <SkeletonLoader width="100%" height={40} borderRadius={DESIGN_TOKENS.radii.md} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Навигация</Text>
      </View>

      <View style={styles.divider} />

      {NAV_SECTIONS.map((section) => (
        <Pressable
          key={section.key}
          style={({ pressed }) => [
            styles.navItem,
            styles.navItemHover,
            pressed && { backgroundColor: colors.surfaceLight },
          ]}
          onPress={() => onSectionPress?.(section.key)}
          accessibilityRole="button"
          accessibilityLabel={`Перейти к: ${section.title}`}
        >
          <View style={styles.navIcon}>
            <Feather name={section.icon as any} size={16} color={colors.textMuted} />
          </View>
          <Text style={styles.navTitle}>{section.title}</Text>
        </Pressable>
      ))}
    </View>
  );
});

SidebarNavSkeleton.displayName = 'SidebarNavSkeleton';

/** Hero section skeleton */
const HeroSkeleton = memo<{ colors: ReturnType<typeof useThemedColors>; isMobile: boolean }>(({ isMobile }) => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingVertical: isMobile ? 40 : 56,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: isMobile ? 24 : 60,
      maxWidth: 1200,
      alignSelf: 'center',
      width: '100%',
    },
    textBlock: {
      flex: 1,
      gap: 16,
    },
    imageBlock: {
      display: isMobile ? 'none' : 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttons: {
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? 12 : 16,
      marginTop: 16,
      width: '100%',
    },
  }), [isMobile]);

  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        <SkeletonLoader width={isMobile ? '90%' : '80%'} height={isMobile ? 32 : 48} borderRadius={8} />
        <SkeletonLoader width="70%" height={20} borderRadius={6} />
        <SkeletonLoader width="55%" height={20} borderRadius={6} />
        <View style={styles.buttons}>
          <SkeletonLoader width={isMobile ? '100%' : 200} height={56} borderRadius={DESIGN_TOKENS.radii.lg} />
          <SkeletonLoader width={isMobile ? '100%' : 220} height={56} borderRadius={DESIGN_TOKENS.radii.lg} />
        </View>
      </View>
      {!isMobile && (
        <View style={styles.imageBlock}>
          <SkeletonLoader width={320} height={400} borderRadius={DESIGN_TOKENS.radii.lg} />
        </View>
      )}
    </View>
  );
});

HeroSkeleton.displayName = 'HeroSkeleton';

/** Trust block skeleton */
const TrustBlockSkeleton = memo<{ colors: ReturnType<typeof useThemedColors>; isMobile: boolean }>(({ colors, isMobile }) => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingVertical: 40,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      maxWidth: 1200,
      alignSelf: 'center',
      width: '100%',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      flexDirection: isMobile ? 'column' : 'row',
      gap: 16,
    },
    item: {
      flex: isMobile ? undefined : 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    itemText: {
      flex: 1,
      gap: 4,
    },
  }), [colors, isMobile]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={`trust-${i}`} style={styles.item}>
            <SkeletonLoader width={34} height={34} borderRadius={10} />
            <View style={styles.itemText}>
              <SkeletonLoader width="60%" height={14} borderRadius={4} />
              <SkeletonLoader width="80%" height={12} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
});

TrustBlockSkeleton.displayName = 'TrustBlockSkeleton';

/** How it works section skeleton */
const HowItWorksSkeleton = memo<{ colors: ReturnType<typeof useThemedColors>; isMobile: boolean }>(({ colors, isMobile }) => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingVertical: 64,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      maxWidth: 1200,
      alignSelf: 'center',
      width: '100%',
    },
    stepsRow: {
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? 20 : 24,
      marginTop: 40,
    },
    stepCard: {
      flex: isMobile ? undefined : 1,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 28,
      gap: 16,
    },
    stepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
  }), [colors, isMobile]);

  return (
    <View style={styles.container}>
      <SkeletonLoader 
        width={isMobile ? 180 : 260} 
        height={isMobile ? 28 : 36} 
        borderRadius={8} 
        style={{ alignSelf: 'center' }} 
      />
      <View style={styles.stepsRow}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={`step-${i}`} style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <SkeletonLoader width={56} height={56} borderRadius={DESIGN_TOKENS.radii.md} />
              <SkeletonLoader width={36} height={36} borderRadius={18} />
            </View>
            <SkeletonLoader width="70%" height={20} borderRadius={6} />
            <SkeletonLoader width="90%" height={14} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
});

HowItWorksSkeleton.displayName = 'HowItWorksSkeleton';

/** Inspiration/cards section skeleton */
const InspirationSkeleton = memo<{ 
  colors: ReturnType<typeof useThemedColors>; 
  isMobile: boolean;
  cardCount?: number;
}>(({ colors, isMobile, cardCount = 3 }) => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingVertical: 72,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      backgroundColor: colors.backgroundSecondary,
      maxWidth: 1200,
      alignSelf: 'center',
      width: '100%',
    },
    cardsRow: {
      flexDirection: isMobile ? 'column' : 'row',
      gap: 20,
      marginTop: 24,
    },
    card: {
      flex: isMobile ? undefined : 1,
      borderRadius: DESIGN_TOKENS.radii.lg,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    cardContent: {
      padding: 12,
      gap: 8,
    },
  }), [colors, isMobile]);

  return (
    <View style={styles.container}>
      <SkeletonLoader width={isMobile ? 200 : 300} height={isMobile ? 28 : 36} borderRadius={8} />
      <SkeletonLoader width={isMobile ? 160 : 240} height={16} borderRadius={4} style={{ marginTop: 8 }} />
      <View style={styles.cardsRow}>
        {Array.from({ length: isMobile ? 2 : cardCount }).map((_, i) => (
          <View key={`card-${i}`} style={styles.card}>
            <SkeletonLoader width="100%" height={200} borderRadius={0} />
            <View style={styles.cardContent}>
              <SkeletonLoader width="80%" height={16} borderRadius={4} />
              <SkeletonLoader width="50%" height={12} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
});

InspirationSkeleton.displayName = 'InspirationSkeleton';

/** FAQ section skeleton */
const FAQSkeleton = memo<{ colors: ReturnType<typeof useThemedColors>; isMobile: boolean }>(({ colors, isMobile }) => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingVertical: 64,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      maxWidth: 1200,
      alignSelf: 'center',
      width: '100%',
    },
    itemsContainer: {
      gap: isMobile ? 8 : 12,
      marginTop: isMobile ? 20 : 32,
    },
    item: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: isMobile ? 12 : 16,
    },
  }), [colors, isMobile]);

  return (
    <View style={styles.container}>
      <SkeletonLoader 
        width={100} 
        height={28} 
        borderRadius={8} 
        style={{ alignSelf: 'center' }} 
      />
      <View style={styles.itemsContainer}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={`faq-${i}`} style={styles.item}>
            <SkeletonLoader width={i % 2 === 0 ? '70%' : '55%'} height={16} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
});

FAQSkeleton.displayName = 'FAQSkeleton';

export interface HomePageSkeletonProps {
  /** Show interactive navigation in sidebar (default: true on web desktop) */
  showSidebarNavigation?: boolean;
  /** Callback when sidebar section is clicked */
  onSectionPress?: (sectionKey: string) => void;
}

/**
 * Main home page skeleton - renders instantly on mount
 * Shows accessible navigation on web while content loads
 */
export const HomePageSkeleton = memo<HomePageSkeletonProps>(({ 
  showSidebarNavigation,
  onSectionPress,
}) => {
  const colors = useThemedColors();
  const { isSmallPhone, isPhone, isTablet } = useResponsive();
  const isMobile = isSmallPhone || isPhone;
  const isDesktop = !isMobile && !isTablet;

  // Only show sidebar navigation on web desktop
  const shouldShowSidebar = Platform.OS === 'web' && isDesktop && showSidebarNavigation !== false;

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      flexDirection: shouldShowSidebar ? 'row' : 'column',
      ...Platform.select({
        web: { minHeight: '100vh' } as any,
      }),
    },
    mainContent: {
      flex: 1,
      minWidth: 0,
    },
    scrollArea: {
      flex: 1,
    },
    inspirationWrapper: {
      backgroundColor: colors.backgroundSecondary,
      width: '100%',
    },
  }), [colors, shouldShowSidebar]);

  const mainContent = (
    <ScrollView 
      style={styles.scrollArea}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: isMobile ? 80 : 96 }}
    >
      <HeroSkeleton colors={colors} isMobile={isMobile} />
      <TrustBlockSkeleton colors={colors} isMobile={isMobile} />
      
      {/* Random travels section */}
      <View style={styles.inspirationWrapper}>
        <InspirationSkeleton colors={colors} isMobile={isMobile} cardCount={3} />
      </View>
      
      <HowItWorksSkeleton colors={colors} isMobile={isMobile} />
      
      {/* Weekend travels section */}
      <View style={styles.inspirationWrapper}>
        <InspirationSkeleton colors={colors} isMobile={isMobile} cardCount={3} />
      </View>
      
      {/* More inspiration */}
      <View style={styles.inspirationWrapper}>
        <InspirationSkeleton colors={colors} isMobile={isMobile} cardCount={3} />
      </View>
      
      <FAQSkeleton colors={colors} isMobile={isMobile} />
    </ScrollView>
  );

  // Desktop with sidebar
  if (shouldShowSidebar) {
    return (
      <View style={styles.container} testID="home-skeleton">
        <SidebarNavSkeleton 
          colors={colors} 
          showNavigation={showSidebarNavigation}
          onSectionPress={onSectionPress}
        />
        <View style={styles.mainContent}>
          {mainContent}
        </View>
      </View>
    );
  }

  // Mobile/tablet layout without sidebar
  return (
    <View style={styles.container} testID="home-skeleton-mobile">
      {mainContent}
    </View>
  );
});

HomePageSkeleton.displayName = 'HomePageSkeleton';

export default memo(HomePageSkeleton);
