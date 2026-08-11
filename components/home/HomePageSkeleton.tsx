import { memo, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { BOOK_IMAGES, MOOD_CARDS } from './homeHeroContent'
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
 *
 * Где это видно: только на Android (и любой не-web платформе) — на web первый
 * экран держит SSG-шелл, а эта ветка недостижима (см. комментарий в
 * `app/(tabs)/index.tsx` у `shouldShowSkeleton`).
 *
 * Статичный текст первого экрана рисуется как есть, а не серыми плашками:
 * заголовок, подзаголовок, плейсхолдер поиска, подпись CTA, названия чипов и
 * бейдж «Маршрут недели» не зависят от данных и известны сразу. Плашки
 * остаются только там, где контент приходит из API (обложка недели, карточки
 * «Популярного»). Тот же принцип, что у SSG-шелла главной на web
 * (scripts/ssg-skeletons.js): до готовности экрана пользователь видит
 * страницу, а не скелетон. Значения типографики продублированы из
 * homeHeroStyles (mobile-ветка): переиспользовать сам модуль мешает не вес —
 * он и так в eager-графе через HomeHero, — а сигнатура `createHomeHeroStyles`,
 * которой нужен полный контекст раскладки (замеренная высота книги, флаги
 * слайдера). Цена дубля: расхождение значений ловится только сравнением с
 * реальным экраном, поэтому правки hero-типографики надо зеркалить сюда.
 */
const MobileHeroSkeleton = memo(({ isSmallPhone }: { isSmallPhone: boolean }) => {
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
        // Значения mobile-ветки createTypographyStyles/createCtaStyles.
        title: {
          fontSize: isSmallPhone ? 28 : 32,
          fontWeight: '700' as const,
          color: colors.text,
          letterSpacing: -0.8,
          lineHeight: isSmallPhone ? 34 : 40,
          textAlign: 'left' as const,
        },
        titleAccent: {
          fontWeight: '800' as const,
          color: colors.brandText,
        },
        subtitle: {
          fontSize: 16,
          fontWeight: '400' as const,
          color: colors.textMuted,
          lineHeight: 24,
          letterSpacing: 0.1,
          maxWidth: 520,
        },
        searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
        searchField: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          height: 46,
          paddingHorizontal: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        searchPlaceholder: {
          flex: 1,
          fontSize: 14,
          color: colors.textMuted,
        },
        searchButton: {
          width: 46,
          height: 46,
          borderRadius: 12,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          backgroundColor: colors.primary,
        },
        cta: {
          flexDirection: 'row',
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          gap: 8,
          height: 46,
          borderRadius: DESIGN_TOKENS.radii.md,
          backgroundColor: colors.primary,
        },
        ctaLabel: {
          // flexShrink обязателен: Text без него в row не сжимается и на длинной
          // локализованной подписи вылезает за кнопку вместо многоточия.
          flexShrink: 1,
          fontSize: 15,
          fontWeight: '600' as const,
          color: colors.textOnPrimary,
        },
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
        chip: {
          width: '47.5%',
          flexDirection: 'row',
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          gap: 10,
          height: 46,
          paddingHorizontal: 14,
          borderRadius: DESIGN_TOKENS.radii.pill,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        // Пятый чип («Карта до 60 км») в реальном ряду растягивается на всю
        // ширину: moodChipWrapItem flexBasis 44% + flexGrow 1.
        chipWide: { width: '100%' },
        chipTitle: {
          flexShrink: 1,
          fontSize: 16,
          fontWeight: '500' as const,
          color: colors.text,
          letterSpacing: -0.12,
        },
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
        // Точная копия slideEyebrow/slideEyebrowText реальной карточки недели
        // (homeHeroStyles/sliderMediaStyles): иначе бейдж прыгает на handoff.
        captionKicker: {
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          gap: 5,
          alignSelf: 'flex-start' as const,
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: 'rgba(252,248,241,0.08)',
          borderWidth: 1,
          borderColor: 'rgba(244,235,221,0.24)',
        },
        captionKickerText: {
          fontSize: 10,
          lineHeight: 14,
          fontWeight: '500' as const,
          letterSpacing: 0.45,
          color: 'rgba(247,240,228,0.94)',
          textTransform: 'uppercase' as const,
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
    [colors, isSmallPhone],
  )

  return (
    <View style={styles.shell} testID="home-skeleton">
      <View style={styles.heroCard}>
        {/* Перенос строки жёсткий, хотя HomeHeroBookLayout на узкой раскладке
            передаёт пробел: у реального hero title-бокс уже (на native карточка
            без рамки, на web — с ней), и замер на устройстве 2026-08-11 показал
            разбивку «Куда поехать / в эти выходные?». Пробел здесь давал
            «Куда поехать в эти / выходные?» — лишний прыжок слова на handoff.
            Ориентир — наблюдаемый рендер, а не тернарник источника. */}
        <Text style={styles.title}>
          {i18nT('home:components.home.HomeHeroBookLayout.kuda_poehat_07cb7b59')}{'\n'}
          <Text style={styles.titleAccent}>
            {i18nT('home:components.home.HomeHeroBookLayout.v_eti_vyhodnye_c69482dd')}
          </Text>
        </Text>
        <Text style={styles.subtitle}>
          {i18nT('home:components.home.HomeHero.realnye_marshruty_po_belarusi_i_evrope_s_fot_9e18c02e')}
        </Text>
        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <Feather name="search" size={18} color={colors.textMuted} />
            <Text style={styles.searchPlaceholder} numberOfLines={1}>
              {i18nT('home:components.home.HomeHeroSearchBar.kuda_hotite_poehat_5f13aee9')}
            </Text>
          </View>
          <View style={styles.searchButton}>
            <Feather name="search" size={18} color={colors.textOnPrimary} />
          </View>
        </View>
        <View style={styles.cta}>
          <Feather name="compass" size={16} color={colors.textOnPrimary} />
          <Text style={styles.ctaLabel} numberOfLines={1}>
            {i18nT('home:components.home.HomeHeroBookLayout.smotret_marshruty_4a0b9a63')}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.chipsGrid}>
        {MOOD_CARDS.map((card, index) => (
          <View
            key={`hero-chip-${card.icon}`}
            style={[styles.chip, index === MOOD_CARDS.length - 1 && styles.chipWide]}
          >
            <Feather name={card.icon} size={19} color={colors.textMuted} />
            <Text style={styles.chipTitle} numberOfLines={1}>
              {card.title}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.featured}>
        <View style={styles.featuredCaption}>
          <View style={styles.captionKicker}>
            <Feather name="map-pin" size={11} color={colors.textOnDark} />
            <Text style={styles.captionKickerText} numberOfLines={1}>
              {i18nT('home:components.home.HomeHeroPopularSection.marshrut_nedeli_b1be152b')}
            </Text>
          </View>
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

const HeroSkeleton = memo(({ isMobile, isSmallPhone }: { isMobile: boolean; isSmallPhone: boolean }) => {
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

  if (isMobile) return <MobileHeroSkeleton isSmallPhone={isSmallPhone} />

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
        <HeroSkeleton isMobile={isMobile} isSmallPhone={isSmallPhone} />
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
