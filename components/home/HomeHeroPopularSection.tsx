import { useMemo } from 'react'
import { Platform, Pressable, ScrollView, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { useVisibleCardCount } from '@/hooks/useVisibleCardCount'
import type { ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { webDataSetProps } from '@/utils/webProps'
import type { BookImage } from './homeHeroContent'

type RouteImage = Pick<BookImage, 'source' | 'compactSource' | 'alt' | 'title' | 'subtitle' | 'href' | 'dominantColor'>

type HomeHeroPopularSectionProps = {
  responsiveWeb?: boolean
  hideFeatured?: boolean
  colors: ThemedColors
  styles: any
  isWeb: boolean
  useMobileGrid: boolean
  featuredCardWidth?: number
  popularCardWidth: number
  popularCardHeight: number
  bookImages: readonly RouteImage[]
  onOpenArticle: (href?: string | null) => void
}

type PopularCardProps = {
  responsiveWeb?: boolean
  image: RouteImage
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

function getBundledWebAssetUri(source: BookImage['source'] | undefined) {
  return source && typeof source === 'object' ? source.uri : undefined
}

function FeaturedRouteCard({
  colors,
  featuredCardWidth,
  image,
  onOpenArticle,
  styles,
}: {
  colors: ThemedColors
  featuredCardWidth?: number
  image: RouteImage
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
      accessibilityLabel={i18nT('home:components.home.HomeHeroPopularSection.otkryt_marshrut_nedeli_value1_value2_2f601bf8', { value1: image.title, value2: image.subtitle })}
    >
      <ImageCardMedia
        source={image.source}
        placeholderColor={image.dominantColor}
        width={featuredCardWidth}
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
          <Text style={styles.slideEyebrowText}>{i18nT('home:components.home.HomeHeroPopularSection.marshrut_nedeli_b1be152b')}</Text>
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
  responsiveWeb = false,
  image,
  styles,
  colors,
  width,
  height,
  onOpenArticle,
  useGridLayout = false,
}: PopularCardProps) {
  const responsiveSource = useMemo(() => {
    if (!responsiveWeb || !image.compactSource) return undefined
    const compact = getBundledWebAssetUri(image.compactSource)
    const full = getBundledWebAssetUri(image.source)
    if (!compact || !full) return undefined
    return {
      src: full,
      srcSet: `${compact} 384w, ${full} 720w`,
      sizes: '(max-width: 767px) calc(50vw - 23px), 720px',
    }
  }, [image.compactSource, image.source, responsiveWeb])

  return (
    <Pressable
      {...(responsiveWeb ? webDataSetProps({ homePopularCard: true }) : {})}
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
      accessibilityLabel={i18nT('home:components.home.HomeHeroPopularSection.otkryt_marshrut_value1_value2_e989c06b', { value1: image.title, value2: image.subtitle })}
    >
      <ImageCardMedia
        source={image.source}
        webResponsiveSource={responsiveSource}
        placeholderColor={image.dominantColor}
        width={responsiveWeb ? '100%' : width}
        height={responsiveWeb ? undefined : height}
        borderRadius={0}
        fit="contain"
        blurBackground
        allowCriticalWebBlur
        quality={72}
        alt={image.alt}
        loading="lazy"
        style={
          useGridLayout
            ? [styles.imageCardImage, responsiveWeb ? { width: '100%', aspectRatio: 3 / 2 } : { width, height }]
            : styles.imageCardImage
        }
      />
      <View style={styles.imageCardContent} {...(responsiveWeb ? webDataSetProps({ homePopularContent: true }) : {})}>
        <Text style={styles.imageCardTitle} numberOfLines={useGridLayout ? 2 : 1}
          {...(responsiveWeb ? webDataSetProps({ homePopularTitle: true }) : {})}>
          {image.title}
        </Text>
        <Text style={styles.imageCardSubtitle} numberOfLines={useGridLayout ? 2 : 1}
          {...(responsiveWeb ? webDataSetProps({ homePopularSubtitle: true }) : {})}>
          {image.subtitle}
        </Text>
      </View>
    </Pressable>
  )
}

export default function HomeHeroPopularSection({
  responsiveWeb = false,
  hideFeatured = false,
  colors,
  styles,
  isWeb,
  useMobileGrid,
  featuredCardWidth,
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
    <View style={styles.popularSection} {...(responsiveWeb ? webDataSetProps({ homePopularSection: true }) : {})}>
      {!hideFeatured && <FeaturedRouteCard
        colors={colors}
        featuredCardWidth={featuredCardWidth}
        image={featuredImage}
        onOpenArticle={onOpenArticle}
        styles={styles}
      />}
      <View style={styles.popularTitleRow}>
        <Text
          style={styles.popularTitle}
          accessibilityRole="header"
          {...({ 'aria-level': 2 } as any)}
        >
          {i18nT('home:components.home.HomeHeroPopularSection.populyarnye_marshruty_870b269e')}</Text>
        {(!useMobileGrid || responsiveWeb) && (
          <Pressable
            {...(responsiveWeb ? webDataSetProps({ homePopularSeeAll: true }) : {})}
            onPress={() => onOpenArticle('/search')}
            style={styles.popularSeeAll}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityRole="link"
            accessibilityLabel={i18nT('home:components.home.HomeHeroPopularSection.smotret_vse_populyarnye_marshruty_f17aa35c')}
          >
            <Text style={styles.popularSeeAllText}>{i18nT('home:components.home.HomeHeroPopularSection.vse_5f903d3d')}</Text>
            <Feather name="arrow-right" size={14} color={colors.primaryDark} />
          </Pressable>
        )}
      </View>
      {useMobileGrid ? (
        <View style={styles.popularGrid} {...(responsiveWeb ? webDataSetProps({ homePopularGrid: true }) : {})}>
          {popularItems.map((image) => (
            <PopularRouteCard
              responsiveWeb={responsiveWeb}
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
