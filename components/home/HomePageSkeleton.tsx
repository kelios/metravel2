import { memo, useMemo } from 'react';
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
/**
 * Мобильная ветка зеркалит реальную мобильную главную: белая карточка
 * (заголовок, подзаголовок, поиск с кнопкой, CTA), разделитель, грид
 * mood-чипов, карточка «Маршрут недели» с заливкой кадра и подписью на
 * скриме, грид «Популярного». Старый вариант рисовал desktop-книгу с рамкой
 * высотой 720 — на телефоне это не совпадало ни с одним реальным экраном.
 */
const MobileHeroSkeleton = memo(() => {
  const colors = useThemedColors()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shell: {
          width: '100%',
          maxWidth: 1200,
          alignSelf: 'center',
          paddingHorizontal: 16,
          paddingTop: 8,
        },
        heroCard: {
          backgroundColor: colors.surface,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 20,
          paddingTop: 44,
          paddingBottom: 20,
          gap: 16,
        },
        titleGroup: { gap: 12 },
        subGroup: { gap: 8 },
        searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
        searchField: { flex: 1 },
        divider: {
          height: 1,
          backgroundColor: colors.border,
          marginTop: 24,
        },
        chipsGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 33,
        },
        chip: { width: '47.5%' },
        chipWide: { width: '68%' },
        featured: {
          marginTop: 34,
          width: '100%',
          aspectRatio: 3 / 2,
          borderRadius: 20,
          overflow: 'hidden',
          // Заливка letterbox цветом кадра первого слайда — как
          // placeholderColor у ImageCardMedia в реальном hero (#1208).
          backgroundColor:
            BOOK_IMAGES[0].dominantColor ?? colors.backgroundSecondary,
          justifyContent: 'flex-end',
        },
        featuredCaption: {
          padding: 16,
          gap: 10,
          alignItems: 'flex-start',
        },
        captionKicker: {
          width: 132,
          height: 24,
          borderRadius: 12,
          backgroundColor: 'rgba(16,22,20,0.45)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.28)',
        },
        captionTitle: {
          width: '56%',
          height: 26,
          borderRadius: 8,
          backgroundColor: 'rgba(255,255,255,0.85)',
        },
        captionSub: {
          width: '74%',
          height: 14,
          borderRadius: 6,
          backgroundColor: 'rgba(255,255,255,0.55)',
        },
        captionAction: {
          width: 150,
          height: 34,
          borderRadius: 17,
          backgroundColor: 'rgba(16,22,20,0.45)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.32)',
        },
        popularRow: {
          flexDirection: 'row',
          gap: 14,
          marginTop: 28,
        },
        popularCard: {
          flex: 1,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          paddingBottom: 12,
        },
        popularLine: { marginTop: 10, marginHorizontal: 12 },
      }),
    [colors],
  )

  return (
    <View style={styles.shell} testID="home-skeleton">
      <View style={styles.heroCard}>
        <View style={styles.titleGroup}>
          <SkeletonLoader width="82%" height={34} borderRadius={8} />
          <SkeletonLoader width="64%" height={34} borderRadius={8} />
        </View>
        <View style={styles.subGroup}>
          <SkeletonLoader width="88%" height={16} borderRadius={6} />
          <SkeletonLoader width="70%" height={16} borderRadius={6} />
        </View>
        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <SkeletonLoader width="100%" height={46} borderRadius={12} />
          </View>
          <SkeletonLoader width={46} height={46} borderRadius={12} />
        </View>
        <SkeletonLoader width="100%" height={46} borderRadius={16} />
      </View>

      <View style={styles.divider} />

      <View style={styles.chipsGrid}>
        {['a', 'b', 'c', 'd'].map((key) => (
          <View key={`hero-chip-${key}`} style={styles.chip}>
            <SkeletonLoader width="100%" height={46} borderRadius={23} />
          </View>
        ))}
        <View style={styles.chipWide}>
          <SkeletonLoader width="100%" height={46} borderRadius={23} />
        </View>
      </View>

      <View style={styles.featured}>
        <View style={styles.featuredCaption}>
          <View style={styles.captionKicker} />
          <View style={styles.captionTitle} />
          <View style={styles.captionSub} />
          <View style={styles.captionAction} />
        </View>
      </View>

      <View style={styles.popularRow}>
        {['a', 'b'].map((key) => (
          <View key={`popular-card-${key}`} style={styles.popularCard}>
            <SkeletonLoader width="100%" height={112} borderRadius={0} />
            <View style={styles.popularLine}>
              <SkeletonLoader width="76%" height={12} borderRadius={6} />
            </View>
            <View style={styles.popularLine}>
              <SkeletonLoader width="55%" height={12} borderRadius={6} />
            </View>
          </View>
        ))}
      </View>
    </View>
  )
})

MobileHeroSkeleton.displayName = 'MobileHeroSkeleton'

const HeroSkeleton = memo(({ isMobile }: { isMobile: boolean }) => {
  const colors = useThemedColors()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shell: {
          width: '100%',
          maxWidth: 1200,
          alignSelf: 'center',
          paddingHorizontal: 24,
          paddingTop: 40,
        },
        book: {
          width: '100%',
          minHeight: 700,
          borderRadius: 36,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: 28,
          overflow: 'hidden',
        },
        pageColumns: {
          flex: 1,
          flexDirection: 'row',
          gap: 28,
          minHeight: 620,
        },
        leftPage: {
          flex: 1,
          justifyContent: 'center',
          gap: 18,
          paddingHorizontal: 18,
        },
        rightPage: {
          flex: 1,
          justifyContent: 'center',
          gap: 16,
          paddingHorizontal: 12,
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
          height: 320,
        },
        featuredText: {
          gap: 10,
          padding: 18,
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
    [colors],
  )

  if (isMobile) return <MobileHeroSkeleton />

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
            <SkeletonLoader width="78%" height={52} borderRadius={10} />
            <SkeletonLoader width="62%" height={52} borderRadius={10} />
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
                    width={500}
                    height={styles.featuredImage.height as number}
                    borderRadius={0}
                    fit="contain"
                    allowCriticalWebBlur
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
