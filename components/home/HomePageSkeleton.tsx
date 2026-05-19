import React, { memo, useMemo } from 'react'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'

import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { useThemedColors } from '@/hooks/useTheme'
import { BOOK_IMAGES } from './homeHeroContent'
import { useHomeViewport } from './useHomeViewport'

const BOOK_ASPECT_RATIO = 1040 / 765
const HOME_SKELETON_FEATURED_SOURCE =
  typeof BOOK_IMAGES[0].source === 'number'
    ? BOOK_IMAGES[0].source
    : { uri: String(BOOK_IMAGES[0].source.uri || '') }

const HeroSkeleton = memo(({ isMobile }: { isMobile: boolean }) => {
  const colors = useThemedColors()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shell: {
          width: '100%',
          maxWidth: 1200,
          alignSelf: 'center',
          paddingHorizontal: isMobile ? 8 : 24,
          paddingTop: isMobile ? 16 : 40,
        },
        book: {
          width: '100%',
          minHeight: isMobile ? 720 : 700,
          borderRadius: 36,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: isMobile ? 18 : 28,
          overflow: 'hidden',
        },
        pageColumns: {
          flex: 1,
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 24 : 28,
          minHeight: isMobile ? 640 : 620,
        },
        leftPage: {
          flex: 1,
          justifyContent: 'center',
          gap: 18,
          paddingHorizontal: isMobile ? 4 : 18,
        },
        rightPage: {
          flex: 1,
          justifyContent: 'center',
          gap: 16,
          paddingHorizontal: isMobile ? 0 : 12,
        },
        chipRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
          marginTop: 6,
        },
        footerRow: {
          flexDirection: 'row',
          gap: 12,
          flexWrap: 'wrap',
          marginTop: 12,
        },
        featuredCard: {
          borderRadius: 22,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.backgroundSecondary,
        },
        featuredImage: {
          width: '100%',
          height: isMobile ? 220 : 320,
        },
        featuredText: {
          gap: 10,
          padding: isMobile ? 16 : 18,
        },
        popularRow: {
          flexDirection: 'row',
          gap: 12,
        },
        popularCard: {
          flex: 1,
          gap: 8,
        },
      }),
    [colors, isMobile],
  )

  return (
    <View style={styles.shell}>
      <View
        style={[
          styles.book,
          Platform.OS === 'web'
            ? ({
                aspectRatio: BOOK_ASPECT_RATIO,
              } as any)
            : null,
        ]}
        testID="home-skeleton"
      >
        <View style={styles.pageColumns}>
          <View style={styles.leftPage}>
            <SkeletonLoader width={92} height={14} borderRadius={7} />
            <SkeletonLoader width="78%" height={isMobile ? 34 : 52} borderRadius={10} />
            <SkeletonLoader width="62%" height={isMobile ? 34 : 52} borderRadius={10} />
            <SkeletonLoader width="72%" height={18} borderRadius={6} />
            <SkeletonLoader width="58%" height={18} borderRadius={6} />
            <View style={styles.chipRow}>
              {['28%', '24%', '22%', '24%', '36%'].map((width, index) => (
                <SkeletonLoader
                  key={`hero-chip-${index}`}
                  width={width as any}
                  height={36}
                  borderRadius={18}
                />
              ))}
            </View>
            <View style={styles.footerRow}>
              <SkeletonLoader width={220} height={52} borderRadius={26} />
            </View>
          </View>

          <View style={styles.rightPage}>
            <View style={styles.featuredCard}>
                {Platform.OS === 'web' ? (
                  <ImageCardMedia
                    source={HOME_SKELETON_FEATURED_SOURCE}
                    width={isMobile ? 380 : 500}
                    height={styles.featuredImage.height as number}
                    borderRadius={0}
                    fit="contain"
                    blurBackground={false}
                    quality={60}
                    alt={BOOK_IMAGES[0].alt}
                    loading="eager"
                    priority="high"
                    style={styles.featuredImage}
                    preserveOptimizedWebSrc
                  />
                ) : (
                  <SkeletonLoader
                    width="100%"
                    height={styles.featuredImage.height as number}
                    borderRadius={0}
                  />
                )}
              <View style={styles.featuredText}>
                <SkeletonLoader width={120} height={22} borderRadius={11} />
                <SkeletonLoader width="56%" height={30} borderRadius={8} />
                <SkeletonLoader width="74%" height={16} borderRadius={6} />
                <SkeletonLoader width={140} height={38} borderRadius={19} />
              </View>
            </View>

            {!isMobile && (
              <>
                <SkeletonLoader width={190} height={20} borderRadius={8} />
                <View style={styles.popularRow}>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <View key={`popular-card-${index}`} style={styles.popularCard}>
                      <SkeletonLoader width="100%" height={124} borderRadius={18} />
                      <SkeletonLoader width="84%" height={16} borderRadius={6} />
                      <SkeletonLoader width="66%" height={14} borderRadius={6} />
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  )
})

HeroSkeleton.displayName = 'HeroSkeleton'

const SectionSkeleton = memo(
  ({
    titleWidth,
    isMobile,
    accent = false,
  }: {
    titleWidth: number | string
    isMobile: boolean
    accent?: boolean
  }) => {
    const colors = useThemedColors()
    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: {
            width: '100%',
            maxWidth: 1200,
            alignSelf: 'center',
            paddingHorizontal: isMobile ? 8 : 24,
            paddingVertical: isMobile ? 28 : 40,
          },
          sectionHeader: {
            gap: 10,
            marginBottom: 22,
          },
          cardRow: {
            flexDirection: isMobile ? 'column' : 'row',
            gap: 18,
          },
          card: {
            flex: 1,
            borderRadius: 24,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          },
          cardContent: {
            gap: 10,
            padding: 16,
          },
        }),
      [colors, isMobile],
    )

    return (
      <View
        style={[
          styles.container,
          accent ? { backgroundColor: colors.backgroundSecondary } : null,
        ]}
      >
        <View style={styles.sectionHeader}>
          <SkeletonLoader width={titleWidth as any} height={isMobile ? 30 : 36} borderRadius={8} />
          <SkeletonLoader width={isMobile ? '72%' : '42%'} height={16} borderRadius={6} />
        </View>
        <View style={styles.cardRow}>
          {Array.from({ length: isMobile ? 2 : 3 }).map((_, index) => (
            <View key={`section-card-${index}`} style={styles.card}>
              <SkeletonLoader width="100%" height={isMobile ? 180 : 210} borderRadius={0} />
              <View style={styles.cardContent}>
                <SkeletonLoader width="76%" height={18} borderRadius={6} />
                <SkeletonLoader width="58%" height={14} borderRadius={6} />
              </View>
            </View>
          ))}
        </View>
      </View>
    )
  },
)

SectionSkeleton.displayName = 'SectionSkeleton'

const HowItWorksSkeleton = memo(({ isMobile }: { isMobile: boolean }) => {
  const colors = useThemedColors()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          width: '100%',
          maxWidth: 1200,
          alignSelf: 'center',
          paddingHorizontal: isMobile ? 8 : 24,
          paddingVertical: isMobile ? 32 : 48,
        },
        titleBlock: {
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: 10,
          marginBottom: 22,
        },
        row: {
          flexDirection: isMobile ? 'column' : 'row',
          gap: 18,
        },
        card: {
          flex: 1,
          gap: 16,
          padding: isMobile ? 18 : 24,
          borderRadius: 24,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
      }),
    [colors, isMobile],
  )

  return (
    <View style={styles.container}>
      <View style={styles.titleBlock}>
        <SkeletonLoader width={isMobile ? 190 : 280} height={isMobile ? 30 : 36} borderRadius={8} />
        <SkeletonLoader width={isMobile ? '78%' : '36%'} height={16} borderRadius={6} />
      </View>
      <View style={styles.row}>
        {Array.from({ length: 3 }).map((_, index) => (
          <View key={`how-card-${index}`} style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <SkeletonLoader width={52} height={52} borderRadius={14} />
              <SkeletonLoader width={34} height={34} borderRadius={17} />
            </View>
            <SkeletonLoader width="68%" height={20} borderRadius={8} />
            <SkeletonLoader width="92%" height={14} borderRadius={6} />
            <SkeletonLoader width="84%" height={14} borderRadius={6} />
          </View>
        ))}
      </View>
    </View>
  )
})

HowItWorksSkeleton.displayName = 'HowItWorksSkeleton'

const FaqSkeleton = memo(({ isMobile }: { isMobile: boolean }) => {
  const colors = useThemedColors()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          width: '100%',
          maxWidth: 1200,
          alignSelf: 'center',
          paddingHorizontal: isMobile ? 8 : 24,
          paddingVertical: isMobile ? 32 : 48,
        },
        stack: {
          gap: 12,
          marginTop: 20,
        },
        item: {
          padding: isMobile ? 14 : 18,
          borderRadius: 18,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
      }),
    [colors, isMobile],
  )

  return (
    <View style={styles.container}>
      <SkeletonLoader width={isMobile ? 170 : 240} height={isMobile ? 30 : 36} borderRadius={8} />
      <View style={styles.stack}>
        {Array.from({ length: 5 }).map((_, index) => (
          <View key={`faq-item-${index}`} style={styles.item}>
            <SkeletonLoader width={index % 2 === 0 ? '64%' : '52%'} height={18} borderRadius={6} />
          </View>
        ))}
      </View>
    </View>
  )
})

FaqSkeleton.displayName = 'FaqSkeleton'

export const HomePageSkeleton = memo(() => {
  const colors = useThemedColors()
  const { isSmallPhone, isPhone, isLargePhone } = useHomeViewport()
  const isMobile = isSmallPhone || isPhone || isLargePhone

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        scrollContent: {
          paddingBottom: isMobile ? 88 : 112,
        },
        accentSection: {
          backgroundColor: colors.backgroundSecondary,
        },
      }),
    [colors, isMobile],
  )

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <HeroSkeleton isMobile={isMobile} />
        <View style={styles.accentSection}>
          <SectionSkeleton isMobile={isMobile} titleWidth={isMobile ? 210 : 280} accent />
        </View>
        <HowItWorksSkeleton isMobile={isMobile} />
        <View style={styles.accentSection}>
          <SectionSkeleton isMobile={isMobile} titleWidth={isMobile ? 240 : 340} accent />
        </View>
        <SectionSkeleton isMobile={isMobile} titleWidth={isMobile ? 220 : 300} />
        <FaqSkeleton isMobile={isMobile} />
      </ScrollView>
    </View>
  )
})

HomePageSkeleton.displayName = 'HomePageSkeleton'

export default HomePageSkeleton
