import { Platform, Pressable, ScrollView, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { useVisibleCardCount } from '@/hooks/useVisibleCardCount'
import type { ThemedColors } from '@/hooks/useTheme'

type BookImage = {
  source: any
  alt: string
  title: string
  subtitle: string
  href?: string
}

type HomeHeroPopularSectionProps = {
  colors: ThemedColors
  styles: any
  isWeb: boolean
  useMobileGrid: boolean
  featuredCardWidth?: number
  featuredCardHeight: number
  popularCardWidth: number
  popularCardHeight: number
  bookImages: readonly BookImage[]
  onOpenArticle: (href?: string | null) => void
}

type PopularCardProps = {
  image: BookImage
  styles: any
  colors: ThemedColors
  width?: number | string
  height: number
  onOpenArticle: (href?: string | null) => void
  useGridLayout?: boolean
}

const webHorizontalScrollStyle =
  Platform.OS === 'web'
    ? ({
        touchAction: 'pan-x pan-y',
        WebkitOverflowScrolling: 'touch',
        overflowX: 'auto',
        overflowY: 'hidden',
        overscrollBehaviorX: 'contain',
      } as const)
    : undefined

const POPULAR_CARD_GAP = 16

function FeaturedRouteCard({
  colors,
  featuredCardHeight,
  featuredCardWidth,
  image,
  onOpenArticle,
  styles,
}: {
  colors: ThemedColors
  featuredCardHeight: number
  featuredCardWidth?: number
  image: BookImage
  onOpenArticle: (href?: string | null) => void
  styles: any
}) {
  return (
    <Pressable
      onPress={() => onOpenArticle(image.href)}
      style={({ pressed, hovered, focused }: any) => [
        styles.featuredCard,
        (pressed || hovered) && styles.featuredCardHover,
        Platform.OS === 'web' && focused && {
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineColor: colors.primary,
          outlineOffset: 2,
        },
      ]}
      accessibilityRole="link"
      accessibilityLabel={`Открыть маршрут недели: ${image.title}. ${image.subtitle}`}
    >
      <ImageCardMedia
        source={image.source}
        width={featuredCardWidth}
        height={featuredCardHeight}
        borderRadius={0}
        fit="contain"
        blurBackground
        allowCriticalWebBlur
        quality={60}
        alt={image.alt}
        loading="eager"
        priority="high"
        style={styles.featuredCardImage}
      />
      <View style={styles.featuredCardOverlay}>
        <View style={styles.slideEyebrow}>
          <Feather
            name="map-pin"
            size={11}
            color={colors.textOnDark}
            {...({ 'aria-hidden': true, focusable: false } as any)}
          />
          <Text style={styles.slideEyebrowText}>Маршрут недели</Text>
        </View>
        <Text style={styles.featuredCardTitle} numberOfLines={1}>
          {image.title}
        </Text>
        <Text style={styles.featuredCardSubtitle} numberOfLines={1}>
          {image.subtitle}
        </Text>
      </View>
    </Pressable>
  )
}

function PopularRouteCard({
  image,
  styles,
  colors,
  width,
  height,
  onOpenArticle,
  useGridLayout = false,
}: PopularCardProps) {
  return (
    <Pressable
      key={image.title}
      onPress={() => onOpenArticle(image.href)}
      style={({ pressed, hovered, focused }: any) => [
        styles.imageCard,
        useGridLayout && styles.imageCardGrid,
        useGridLayout && width ? { width } : null,
        (pressed || hovered) && styles.imageCardHover,
        Platform.OS === 'web' && focused && {
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineColor: colors.primary,
          outlineOffset: 2,
        },
      ]}
      accessibilityRole="link"
      accessibilityLabel={`Открыть маршрут: ${image.title}. ${image.subtitle}`}
    >
      <ImageCardMedia
        source={image.source}
        width={width}
        height={height}
        borderRadius={0}
        fit="contain"
        blurBackground
        allowCriticalWebBlur
        quality={72}
        alt={image.alt}
        loading="lazy"
        style={
          useGridLayout
            ? [styles.imageCardImage, { width, height }]
            : styles.imageCardImage
        }
      />
      <View style={styles.imageCardContent}>
        <Text style={styles.imageCardTitle} numberOfLines={useGridLayout ? 2 : 1}>
          {image.title}
        </Text>
        <Text style={styles.imageCardSubtitle} numberOfLines={useGridLayout ? 2 : 1}>
          {image.subtitle}
        </Text>
      </View>
    </Pressable>
  )
}

export default function HomeHeroPopularSection({
  colors,
  styles,
  isWeb,
  useMobileGrid,
  featuredCardWidth,
  featuredCardHeight,
  popularCardWidth,
  popularCardHeight,
  bookImages,
  onOpenArticle,
}: HomeHeroPopularSectionProps) {
  const featuredImage = bookImages[0]
  const popularItems = useMobileGrid ? bookImages.slice(1, 5) : bookImages.slice(1)
  const popularPreview = useVisibleCardCount({
    itemCount: popularItems.length,
    itemWidth: popularCardWidth,
    gap: POPULAR_CARD_GAP,
  })

  return (
    <View style={styles.popularSection}>
      <FeaturedRouteCard
        colors={colors}
        featuredCardHeight={featuredCardHeight}
        featuredCardWidth={featuredCardWidth}
        image={featuredImage}
        onOpenArticle={onOpenArticle}
        styles={styles}
      />
      <View style={styles.popularTitleRow}>
        <Text
          style={styles.popularTitle}
          accessibilityRole="header"
          {...({ 'aria-level': 2 } as any)}
        >
          Популярные маршруты
        </Text>
        {!useMobileGrid && (
          <Pressable
            onPress={() => onOpenArticle('/search')}
            style={styles.popularSeeAll}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityRole="link"
            accessibilityLabel="Смотреть все популярные маршруты"
          >
            <Text style={styles.popularSeeAllText}>Все</Text>
            <Feather name="arrow-right" size={14} color={colors.primaryDark} />
          </Pressable>
        )}
      </View>
      {useMobileGrid ? (
        <View style={styles.popularGrid}>
          {popularItems.map((image) => (
            <PopularRouteCard
              key={image.title}
              image={image}
              styles={styles}
              colors={colors}
              width={popularCardWidth}
              height={popularCardHeight}
              onOpenArticle={onOpenArticle}
              useGridLayout
            />
          ))}
        </View>
      ) : isWeb ? (
        <View style={styles.popularPreviewRow} onLayout={popularPreview.onLayout}>
          {popularItems.slice(0, popularPreview.visibleCount).map((image) => (
            <PopularRouteCard
              key={image.title}
              image={image}
              styles={styles}
              colors={colors}
              width={popularCardWidth}
              height={popularCardHeight}
              onOpenArticle={onOpenArticle}
            />
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={isWeb ? webHorizontalScrollStyle : undefined}
          contentContainerStyle={styles.popularScrollContent}
          directionalLockEnabled={Platform.OS === 'ios'}
          nestedScrollEnabled={Platform.OS === 'android'}
        >
          {popularItems.map((image) => (
            <PopularRouteCard
              key={image.title}
              image={image}
              styles={styles}
              colors={colors}
              width={popularCardWidth}
              height={popularCardHeight}
              onOpenArticle={onOpenArticle}
            />
          ))}
        </ScrollView>
      )}
    </View>
  )
}
