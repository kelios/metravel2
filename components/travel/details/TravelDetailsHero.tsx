import React, { Suspense, useEffect, useMemo, useState } from 'react'
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import QuickFacts from '@/components/travel/QuickFacts'
import AuthorCard from '@/components/travel/AuthorCard'
import ShareButtons from '@/components/travel/ShareButtons'
import WeatherWidget from '@/components/WeatherWidget'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import {
  createSafeImageUrl,
  getSafeOrigin,
  isSafePreconnectDomain,
} from '@/utils/travelDetailsSecure'
import {
  buildResponsiveImageProps,
  buildVersionedImageUrl,
  getPreferredImageFormat,
  optimizeImageUrl,
} from '@/utils/imageOptimization'
import type { Travel } from '@/src/types/types'
import type { TravelSectionLink } from '@/components/travel/sectionLinks'

import type { AnchorsMap } from './TravelDetailsTypes'
import { styles } from './TravelDetailsStyles'
import { withLazy } from './TravelDetailsLazy'
import { Icon } from './TravelDetailsIcons'

const Slider = withLazy(() => import('@/components/travel/Slider'))
const HERO_QUICK_JUMP_KEYS = ['map', 'description', 'points'] as const

const getOrigin = getSafeOrigin
const buildVersioned = (url?: string, updated_at?: string | null, id?: any) =>
  createSafeImageUrl(url, updated_at, id)

export const useLCPPreload = (travel?: Travel, isMobile?: boolean) => {
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const first = travel?.gallery?.[0]
    if (!first) return

    const imageUrl = typeof first === 'string' ? first : first.url
    const updatedAt = typeof first === 'string' ? undefined : first.updated_at
    const id = typeof first === 'string' ? undefined : first.id

    if (!imageUrl) return

    const versionedHref = buildVersioned(imageUrl, updatedAt, id)
    const targetWidth =
      typeof window !== 'undefined'
        ? Math.min(window.innerWidth || 1200, isMobile ? 480 : 1440)
        : 1200
    const optimizedHref =
      optimizeImageUrl(versionedHref, {
        width: targetWidth,
        format: getPreferredImageFormat(),
        quality: isMobile ? 75 : 85,
        fit: 'contain',
      }) || versionedHref

    if (!document.querySelector(`link[rel="preload"][as="image"][href="${optimizedHref}"]`)) {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = optimizedHref
      link.setAttribute('fetchpriority', 'high')
      link.setAttribute('referrerpolicy', 'no-referrer')
      document.head.appendChild(link)
    }

    const domains = [
      getOrigin(imageUrl),
      'https://maps.googleapis.com',
      'https://img.youtube.com',
      'https://api.metravel.by',
    ].filter((d): d is string => isSafePreconnectDomain(d))

    domains.forEach((d) => {
      if (!document.querySelector(`link[rel="preconnect"][href="${d}"]`)) {
        const l = document.createElement('link')
        l.rel = 'preconnect'
        l.href = d
        l.crossOrigin = 'anonymous'
        document.head.appendChild(l)
      }
    })
  }, [isMobile, travel?.gallery])
}

/* -------------------- LCP Hero -------------------- */
type ImgLike = {
  url: string
  width?: number
  height?: number
  updated_at?: string | null
  id?: number | string
}

const NeutralHeroPlaceholder: React.FC<{ height?: number }> = ({ height }) => {
  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          width: '100%',
          height: height ? `${height}px` : '100%',
          borderRadius: 12,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.02) 100%)',
          border: '1px solid rgba(0,0,0,0.06)',
          boxSizing: 'border-box',
        }}
        aria-hidden="true"
      />
    )
  }

  return (
    <View
      style={{
        width: '100%',
        height: height,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
      }}
    />
  )
}

export const OptimizedLCPHero: React.FC<{
  img: ImgLike
  alt?: string
  onLoad?: () => void
  height?: number
  isMobile?: boolean
}> = ({ img, alt, onLoad, height, isMobile }) => {
  const [loadError, setLoadError] = useState(false)
  const baseSrc = buildVersionedImageUrl(
    buildVersioned(img.url, img.updated_at ?? null, img.id),
    img.updated_at ?? null,
    img.id
  )
  const ratio = img.width && img.height ? img.width / img.height : 16 / 9
  const targetWidth =
    typeof window !== 'undefined'
      ? Math.min(window.innerWidth || 1200, isMobile ? 480 : 1440)
      : 1200

  const responsive = buildResponsiveImageProps(baseSrc, {
    maxWidth: targetWidth,
    quality: isMobile ? 75 : 85,
    format: getPreferredImageFormat(),
    fit: 'contain',
  })

  const srcWithRetry = responsive.src || baseSrc

  if (Platform.OS !== 'web') {
    return (
      <View style={{ width: '100%', height: '100%' }}>
        {loadError ? (
          <NeutralHeroPlaceholder height={height} />
        ) : (
          <View style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }}>
            <ImageCardMedia
              src={srcWithRetry}
              fit="cover"
              blurBackground
              blurOnly
              blurRadius={12}
              cachePolicy="memory-disk"
              priority="low"
              style={StyleSheet.absoluteFill}
              borderRadius={12}
            />
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: 'rgba(255,255,255,0.18)',
              }}
            />
            <ImageCardMedia
              src={srcWithRetry}
              fit="contain"
              blurBackground={false}
              cachePolicy="memory-disk"
              priority="high"
              borderRadius={12}
              imageProps={{
                contentPosition: 'center',
              }}
              onLoad={() => {
                setLoadError(false)
                onLoad?.()
              }}
              onError={() => setLoadError(true)}
              style={{ width: '100%', height: '100%' }}
            />
          </View>
        )}
      </View>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', contain: 'layout style paint' as any }}>
      {loadError ? (
        <NeutralHeroPlaceholder height={height} />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 12,
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: '#e9e7df',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}
          />
          <img
            src={srcWithRetry}
            srcSet={responsive.srcSet}
            sizes={responsive.sizes}
            alt={alt || ''}
            width={img.width || 1200}
            height={img.height || Math.round(1200 / ratio)}
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'contain',
            }}
            loading="eager"
            decoding="async"
            // @ts-ignore
            fetchpriority="high"
            referrerPolicy="no-referrer"
            data-lcp
            onLoad={onLoad as any}
            onError={() => setLoadError(true)}
          />
        </div>
      )}
    </div>
  )
}

export function TravelHeroSection({
  travel,
  anchors,
  isMobile,
  renderSlider = true,
  onFirstImageLoad,
  sectionLinks,
  onQuickJump,
}: {
  travel: Travel
  anchors: AnchorsMap
  isMobile: boolean
  renderSlider?: boolean
  onFirstImageLoad: () => void
  sectionLinks: TravelSectionLink[]
  onQuickJump: (key: string) => void
}) {
  const { width: winW, height: winH } = useWindowDimensions()
  const [heroContainerWidth, setHeroContainerWidth] = useState<number | null>(null)
  const firstImg = (travel?.gallery?.[0] ?? null) as unknown as ImgLike | null
  const aspectRatio =
    (firstImg?.width && firstImg?.height ? firstImg.width / firstImg.height : undefined) || 16 / 9
  const resolvedWidth = heroContainerWidth ?? winW
  const heroHeight = useMemo(() => {
    if (Platform.OS === 'web' && !isMobile) return 420
    if (!resolvedWidth) return isMobile ? 280 : 420
    if (isMobile) {
      const mobileHeight = winH * 0.8
      return Math.max(200, Math.min(mobileHeight, winH * 0.85))
    }
    const h = resolvedWidth / (aspectRatio || 16 / 9)
    return Math.max(320, Math.min(h, 640))
  }, [aspectRatio, isMobile, winH, resolvedWidth])
  const galleryImages = useMemo(
    () =>
      travel.gallery?.map((item, index) =>
        typeof item === 'string'
          ? { url: item, id: index }
          : { ...item, id: item.id || index }
      ) || [],
    [travel.gallery]
  )
  const heroAlt = travel?.name ? `Фотография маршрута «${travel.name}»` : 'Фото путешествия'
  const shouldShowOptimizedHero = Platform.OS === 'web' && !!firstImg
  const quickJumpLinks = useMemo(() => {
    return HERO_QUICK_JUMP_KEYS.map((key) => sectionLinks.find((link) => link.key === key)).filter(
      Boolean
    ) as TravelSectionLink[]
  }, [sectionLinks])

  return (
    <>
      <View
        ref={anchors.gallery}
        testID="travel-details-section-gallery"
        collapsable={false}
        {...(Platform.OS === 'web'
          ? {
              // @ts-ignore - устанавливаем data-атрибут для Intersection Observer
              'data-section-key': 'gallery',
            }
          : {})}
      />

      <View testID="travel-details-hero" style={[styles.sectionContainer, styles.contentStable]}>
        <View
          style={styles.sliderContainer}
          collapsable={false}
          onLayout={
            Platform.OS === 'web'
              ? undefined
              : (e: LayoutChangeEvent) => {
                  const w = e.nativeEvent.layout.width
                  if (w && Math.abs((heroContainerWidth ?? 0) - w) > 2) {
                    setHeroContainerWidth(w)
                  }
                }
          }
        >
          {!firstImg ? (
            <NeutralHeroPlaceholder height={heroHeight} />
          ) : shouldShowOptimizedHero && !renderSlider ? (
            <OptimizedLCPHero
              img={{
                url: firstImg.url,
                width: firstImg.width,
                height: firstImg.height,
                updated_at: firstImg.updated_at,
                id: firstImg.id,
              }}
              alt={heroAlt}
              height={heroHeight}
              isMobile={isMobile}
              onLoad={onFirstImageLoad}
            />
          ) : (
            <Slider
              key={`${isMobile ? 'mobile' : 'desktop'}`}
              images={galleryImages}
              showArrows={!isMobile}
              hideArrowsOnMobile
              showDots={isMobile}
              preloadCount={isMobile ? 1 : 2}
              blurBackground
              neutralFirstSlideErrorPlaceholder
              aspectRatio={aspectRatio as number}
              mobileHeightPercent={0.6}
              onFirstImageLoad={onFirstImageLoad}
            />
          )}
        </View>
      </View>

      <View
        testID="travel-details-quick-facts"
        style={[styles.sectionContainer, styles.contentStable, styles.quickFactsContainer]}
      >
        <QuickFacts travel={travel} />
      </View>

      {isMobile && travel.travelAddress && (
        <View style={[styles.sectionContainer, styles.contentStable, { marginTop: 16 }]}>
          <Suspense fallback={null}>
            <WeatherWidget points={travel.travelAddress as any} />
          </Suspense>
        </View>
      )}

      {quickJumpLinks.length > 0 && (
        <View style={[styles.sectionContainer, styles.contentStable, styles.quickJumpWrapper]}>
          {isMobile ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickJumpScrollContent}
              style={styles.quickJumpScroll}
            >
              {quickJumpLinks.map((link) => (
                <Pressable
                  key={link.key}
                  onPress={() => onQuickJump(link.key)}
                  style={({ pressed }) => [styles.quickJumpChip, pressed && styles.quickJumpChipPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Перейти к разделу ${link.label}`}
                >
                  <Icon name={link.icon} size={18} color={DESIGN_TOKENS.colors.primary} />
                  <Text style={styles.quickJumpLabel}>{link.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            quickJumpLinks.map((link) => (
              <Pressable
                key={link.key}
                onPress={() => onQuickJump(link.key)}
                style={({ pressed }) => [styles.quickJumpChip, pressed && styles.quickJumpChipPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Перейти к разделу ${link.label}`}
              >
                <Icon name={link.icon} size={18} color={DESIGN_TOKENS.colors.primary} />
                <Text style={styles.quickJumpLabel}>{link.label}</Text>
              </Pressable>
            ))
          )}
        </View>
      )}

      {isMobile && (
        <View
          testID="travel-details-primary-actions"
          style={[styles.sectionContainer, styles.contentStable, styles.shareButtonsContainer]}
        >
          <ShareButtons travel={travel} />
        </View>
      )}

      {!isMobile && (
        <View
          testID="travel-details-author"
          style={[styles.sectionContainer, styles.contentStable, styles.authorCardContainer]}
        >
          <Text style={styles.sectionHeaderText}>Автор</Text>
          <Text style={styles.sectionSubtitle}>Профиль, соцсети и другие путешествия автора</Text>
          <View style={{ marginTop: 12 }}>
            <AuthorCard travel={travel} />
          </View>
        </View>
      )}
    </>
  )
}

export const __testables = {
  OptimizedLCPHero,
  useLCPPreload,
  TravelHeroSection,
}
