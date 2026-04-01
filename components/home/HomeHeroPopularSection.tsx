import React from 'react'
import { Platform, Pressable, ScrollView, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
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
  isMobile: boolean
  isWeb: boolean
  featuredCardWidth?: number
  featuredCardHeight: number
  bookImages: readonly BookImage[]
  onOpenArticle: (href?: string | null) => void
}

export default function HomeHeroPopularSection({
  colors,
  styles,
  isMobile,
  isWeb,
  featuredCardWidth,
  featuredCardHeight,
  bookImages,
  onOpenArticle,
}: HomeHeroPopularSectionProps) {
  return (
    <View style={styles.popularSection}>
      <Pressable
        onPress={() => onOpenArticle(bookImages[0].href)}
        style={({ pressed, hovered }) => [
          styles.featuredCard,
          (pressed || hovered) && styles.featuredCardHover,
        ]}
        accessibilityRole="link"
        accessibilityLabel={`Открыть маршрут: ${bookImages[0].title}`}
      >
        <ImageCardMedia
          source={bookImages[0].source}
          width={featuredCardWidth}
          height={featuredCardHeight}
          borderRadius={0}
          fit="contain"
          blurBackground
          allowCriticalWebBlur
          quality={72}
          alt={bookImages[0].alt}
          loading="eager"
          style={styles.featuredCardImage}
        />
        <View style={styles.featuredCardOverlay}>
          <View style={styles.slideEyebrow}>
            <Feather name="map-pin" size={11} color={colors.textOnDark} />
            <Text style={styles.slideEyebrowText}>Маршрут недели</Text>
          </View>
          <Text style={styles.featuredCardTitle} numberOfLines={1}>
            {bookImages[0].title}
          </Text>
          <Text style={styles.featuredCardSubtitle} numberOfLines={1}>
            {bookImages[0].subtitle}
          </Text>
        </View>
      </Pressable>
      <Text style={styles.popularTitle}>Популярные маршруты</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={
          isWeb
            ? ({
                touchAction: 'pan-x pan-y',
                WebkitOverflowScrolling: 'touch',
                overflowX: 'auto',
                overflowY: 'hidden',
                overscrollBehaviorX: 'contain',
              } as any)
            : undefined
        }
        contentContainerStyle={styles.popularScrollContent}
        directionalLockEnabled={Platform.OS === 'ios'}
        nestedScrollEnabled={Platform.OS === 'android'}
      >
        {bookImages.map((image) => (
          <Pressable
            key={image.title}
            onPress={() => onOpenArticle(image.href)}
            style={({ pressed, hovered }) => [
              styles.imageCard,
              (pressed || hovered) && styles.imageCardHover,
            ]}
            accessibilityRole="button"
            accessibilityLabel={image.title}
          >
            <ImageCardMedia
              source={image.source}
              width={isMobile ? 195 : 215}
              height={isMobile ? 130 : 148}
              borderRadius={0}
              fit="cover"
              blurBackground
              allowCriticalWebBlur
              quality={85}
              alt={image.alt}
              loading="lazy"
              style={styles.imageCardImage}
            />
            <View style={styles.imageCardContent}>
              <Text style={styles.imageCardTitle} numberOfLines={1}>
                {image.title}
              </Text>
              <Text style={styles.imageCardSubtitle} numberOfLines={1}>
                {image.subtitle}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}
