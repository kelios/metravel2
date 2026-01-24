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
import { useThemedColors } from '@/hooks/useTheme'
import {
  createSafeImageUrl,
  getSafeOrigin,
  isSafePreconnectDomain,
} from '@/utils/travelDetailsSecure'
import {
  buildResponsiveImageProps,
  buildVersionedImageUrl,
  getPreferredImageFormat,
} from '@/utils/imageOptimization'
import type { Travel } from '@/src/types/types'
import type { TravelSectionLink } from '@/components/travel/sectionLinks'

import type { AnchorsMap } from './TravelDetailsTypes'
import { useTravelDetailsStyles } from './TravelDetailsStyles'
import { withLazy } from './TravelDetailsLazy'
import { Icon } from './TravelDetailsIcons'

const Slider = withLazy(() => import('@/components/travel/Slider'))
const QuickFacts = withLazy(() => import('@/components/travel/QuickFacts'))
const AuthorCard = withLazy(() => import('@/components/travel/AuthorCard'))
const ShareButtons = withLazy(() => import('@/components/travel/ShareButtons'))
const WeatherWidget = withLazy(() => import('@/components/WeatherWidget'))
const HERO_QUICK_JUMP_KEYS = ['map', 'description', 'points'] as const

const getOrigin = getSafeOrigin
const buildVersioned = (url?: string, updated_at?: string | null, id?: any) =>
  createSafeImageUrl(url, updated_at, id)

const buildApiPrefixedUrl = (value: string): string | null => {
  try {
    const baseRaw =
      process.env.EXPO_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!/\/api\/?$/i.test(baseRaw)) return null

    const apiOrigin = baseRaw.replace(/\/api\/?$/, '')
    const parsed = new URL(value, apiOrigin)
    if (parsed.pathname.startsWith('/api/')) return null

    return `${apiOrigin}/api${parsed.pathname}${parsed.search}`
  } catch {
    return null
  }
}

export const useLCPPreload = (travel?: Travel, isMobile?: boolean) => {
  useEffect(() => {
    if (Platform.OS !== 'web') return
    // global dedupe set to avoid creating duplicate preload/prefetch tags
    if (!(window as any).__metravel_lcp_preloaded) {
      (window as any).__metravel_lcp_preloaded = new Set<string>()
    }
    const createdLinks: HTMLLinkElement[] = []
    const first = travel?.gallery?.[0]
    if (!first) return

    const imageUrl = typeof first === 'string' ? first : first.url
    const updatedAt = typeof first === 'string' ? undefined : first.updated_at
    const id = typeof first === 'string' ? undefined : first.id

    if (!imageUrl) return

    const versionedHref = buildVersioned(imageUrl, updatedAt, id)
    const lcpMaxWidth = isMobile ? 480 : 960
    const lcpWidths = isMobile ? [320, 420, 480] : [640, 768, 960]
    const targetWidth =
      typeof window !== 'undefined'
        ? Math.min(window.innerWidth || lcpMaxWidth, lcpMaxWidth)
        : lcpMaxWidth
    const lcpQuality = isMobile ? 55 : 60
    const responsive = buildResponsiveImageProps(versionedHref, {
      maxWidth: targetWidth,
      widths: lcpWidths,
      quality: lcpQuality,
      format: getPreferredImageFormat(),
      fit: 'contain',
      sizes: isMobile ? '100vw' : '(max-width: 1024px) 92vw, 860px',
    })
    const _optimizedHref = responsive.src || versionedHref

    const optimizedOrigin = (() => {
      try {
        return _optimizedHref ? new URL(_optimizedHref).origin : null
      } catch {
        return null
      }
    })()

    const rel = document.readyState === 'complete' ? 'prefetch' : 'preload'
    const preloadHref = buildApiPrefixedUrl(_optimizedHref) ?? _optimizedHref
    const preloadKey = preloadHref
    const already = (window as any).__metravel_lcp_preloaded.has(preloadKey)
    if (preloadHref && !already && !document.querySelector(`link[rel="${rel}"][href="${preloadHref}"]`)) {
      (window as any).__metravel_lcp_preloaded.add(preloadKey)
      const preload = document.createElement('link')
      preload.rel = rel
      preload.as = 'image'
      preload.href = preloadHref
      if (responsive.srcSet) preload.setAttribute('imagesrcset', responsive.srcSet)
      if (responsive.sizes) preload.setAttribute('imagesizes', responsive.sizes)
      if (rel === 'preload') {
        preload.fetchPriority = 'high'
        preload.setAttribute('fetchpriority', 'high')
      }
      preload.crossOrigin = 'anonymous'
      document.head.appendChild(preload)
      createdLinks.push(preload)
    }

    const domains = [
      getOrigin(imageUrl),
      optimizedOrigin,
    ].filter((d): d is string => isSafePreconnectDomain(d))

    domains.forEach((d) => {
      if (!document.querySelector(`link[rel="preconnect"][href="${d}"]`)) {
        const l = document.createElement('link')
        l.rel = 'preconnect'
        l.href = d
        l.crossOrigin = 'anonymous'
        document.head.appendChild(l)
        createdLinks.push(l)
      }
    })
    return () => {
      createdLinks.forEach((link) => {
        try {
          link.parentNode?.removeChild(link)
        } catch {
          // noop
        }
      })
    }
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
  const colors = useThemedColors();
  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          width: '100%',
          height: height ? `${height}px` : '100%',
          borderRadius: 12,
          // React Native Web doesn't support shorthand `background`; use long-form.
          backgroundColor: colors.backgroundSecondary,
          // @ts-ignore web-only property
          backgroundImage: `linear-gradient(180deg, ${colors.backgroundSecondary} 0%, ${colors.backgroundTertiary} 100%)`,
          border: `1px solid ${colors.borderLight}`,
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
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.borderLight,
      }}
    />
  )
}

const OptimizedLCPHeroInner: React.FC<{
  img: ImgLike
  alt?: string
  onLoad?: () => void
  height?: number
  isMobile?: boolean
}> = ({ img, alt, onLoad, height, isMobile }) => {
  const [loadError, setLoadError] = useState(false)
  const [overrideSrc, setOverrideSrc] = useState<string | null>(null)
  const [didTryApiPrefix, setDidTryApiPrefix] = useState(false)
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема
  const baseSrc = buildVersionedImageUrl(
    buildVersioned(img.url, img.updated_at ?? null, img.id),
    img.updated_at ?? null,
    img.id
  )
  const ratio = img.width && img.height ? img.width / img.height : 16 / 9
  const lcpMaxWidth = isMobile ? 480 : 960
  const lcpWidths = isMobile ? [320, 420, 480] : [640, 768, 960]
  const targetWidth =
    typeof window !== 'undefined'
      ? Math.min(window.innerWidth || lcpMaxWidth, lcpMaxWidth)
      : lcpMaxWidth
  const lcpQuality = isMobile ? 55 : 70

  const responsive = buildResponsiveImageProps(baseSrc, {
    maxWidth: targetWidth,
    widths: lcpWidths,
    quality: lcpQuality,
    format: getPreferredImageFormat(),
    fit: 'contain',
    sizes: isMobile
      ? '100vw'
      : '(max-width: 1024px) 92vw, 860px',
  })

  const srcWithRetry = overrideSrc || responsive.src || baseSrc
  const fixedHeight = height ? `${Math.round(height)}px` : '100%'

  if (!srcWithRetry) {
    return <NeutralHeroPlaceholder height={height} />
  }

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
                backgroundColor: colors.surfaceMuted,
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
    <div
      style={{
        width: '100%',
        height: fixedHeight,
        ...(height ? { minHeight: fixedHeight } : null),
        contain: 'layout style paint' as any,
      }}
    >
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
            backgroundColor: colors.backgroundSecondary,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: colors.surfaceMuted,
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
            // @ts-ignore - React supports fetchPriority on img, but TS DOM typings may vary
            fetchPriority="high"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            data-lcp
            onLoad={onLoad as any}
            onError={() => {
              if (!didTryApiPrefix) {
                const fallback = buildApiPrefixedUrl(srcWithRetry)
                if (fallback) {
                  setDidTryApiPrefix(true)
                  setOverrideSrc(fallback)
                  return
                }
                setDidTryApiPrefix(true)
              }
              setLoadError(true)
            }}
          />
        </div>
      )}
    </div>
  )
}

function TravelHeroSectionInner({
  travel,
  anchors,
  isMobile,
  renderSlider = true,
  onFirstImageLoad,
  sectionLinks,
  onQuickJump,
  deferExtras = false,
}: {
  travel: Travel
  anchors: AnchorsMap
  isMobile: boolean
  renderSlider?: boolean
  onFirstImageLoad: () => void
  sectionLinks: TravelSectionLink[]
  onQuickJump: (key: string) => void
  deferExtras?: boolean
}) {
  const styles = useTravelDetailsStyles()
  const colors = useThemedColors()
  const { width: winW, height: winH } = useWindowDimensions()
  const [heroContainerWidth, setHeroContainerWidth] = useState<number | null>(null)
  const [extrasReady, setExtrasReady] = useState(!deferExtras || Platform.OS !== 'web')
  const firstImg = (travel?.gallery?.[0] ?? null) as unknown as ImgLike | null
  const aspectRatio =
    (firstImg?.width && firstImg?.height ? firstImg.width / firstImg.height : undefined) || 16 / 9
  const resolvedWidth = heroContainerWidth ?? winW
  const heroHeight = useMemo(() => {
    // ✅ РЕДИЗАЙН: Уменьшение высоты на 15%
    if (Platform.OS === 'web' && !isMobile) return 357; // было 420 (-15%)
    if (!resolvedWidth) return isMobile ? 238 : 357; // было 280/420 (-15%)
    if (isMobile) {
      const mobileHeight = winH * 0.68; // было 0.8 (-15%)
      return Math.max(170, Math.min(mobileHeight, winH * 0.72)); // было 200/0.85 (-15%)
    }
    const h = resolvedWidth / (aspectRatio || 16 / 9)
    return Math.max(272, Math.min(h, 544)); // было 320/640 (-15%)
  }, [aspectRatio, isMobile, winH, resolvedWidth])
  const galleryImages = useMemo(() => {
    const gallery = Array.isArray(travel.gallery) ? travel.gallery : []
    return gallery.map((item, index) =>
      typeof item === 'string'
        ? { url: item, id: index }
        : { ...item, id: item.id || index }
    )
  }, [travel.gallery])
  const heroAlt = travel?.name ? `Фотография маршрута «${travel.name}»` : 'Фото путешествия'
  const shouldShowOptimizedHero = Platform.OS === 'web' && !!firstImg
  const canShowSlider = renderSlider
  const quickJumpLinks = useMemo(() => {
    return HERO_QUICK_JUMP_KEYS.map((key) => sectionLinks.find((link) => link.key === key)).filter(
      Boolean
    ) as TravelSectionLink[]
  }, [sectionLinks])

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setExtrasReady(true)
      return
    }
    if (!deferExtras) {
      setExtrasReady(true)
      return
    }

    let cancelled = false
    const kick = () => {
      if (!cancelled) setExtrasReady(true)
    }
    if (typeof (window as any)?.requestIdleCallback === 'function') {
      ;(window as any).requestIdleCallback(kick, { timeout: 1200 })
    } else {
      setTimeout(kick, 800)
    }
    return () => {
      cancelled = true
    }
  }, [deferExtras])

  return (
    <>
      <View
        ref={anchors.gallery}
        testID="travel-details-section-gallery"
        collapsable={false}
        style={Platform.OS === 'web' ? { height: 0 } : undefined}
        {...(Platform.OS === 'web'
          ? {
              // @ts-ignore - устанавливаем data-атрибут для Intersection Observer
              'data-section-key': 'gallery',
            }
          : {})}
      />

      <View
        testID="travel-details-hero"
        accessibilityRole="none"
        accessibilityLabel="Галерея маршрута"
        style={[styles.sectionContainer, styles.contentStable]}
      >
        <View
        style={[styles.sliderContainer, Platform.OS === 'web' && { minHeight: heroHeight }]}
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
          ) : shouldShowOptimizedHero && !canShowSlider ? (
            <OptimizedLCPHeroInner
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
                autoPlay={false}
                preloadCount={Platform.OS === 'web' ? 0 : isMobile ? 1 : 2}
                blurBackground
                aspectRatio={aspectRatio as number}
              mobileHeightPercent={0.6}
              onFirstImageLoad={onFirstImageLoad}
            />
          )}
        </View>
      </View>

      <View
        testID="travel-details-quick-facts"
        accessibilityRole="none"
        accessibilityLabel="Краткие факты"
        style={[styles.sectionContainer, styles.contentStable, styles.quickFactsContainer]}
      >
        {extrasReady ? (
          <Suspense fallback={<View style={{ minHeight: 72 }} />}>
            <QuickFacts travel={travel} />
          </Suspense>
        ) : (
          <View style={{ minHeight: 72 }} />
        )}
      </View>

      {isMobile && travel.travelAddress && extrasReady && (
        <View
          accessibilityRole="none"
          accessibilityLabel="Погода"
          style={[styles.sectionContainer, styles.contentStable, { marginTop: 16 }]}
        >
          <Suspense fallback={<View style={{ minHeight: 120 }} />}>
            <WeatherWidget points={travel.travelAddress as any} />
          </Suspense>
        </View>
      )}

      {quickJumpLinks.length > 0 && extrasReady && (
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
                  <Icon name={link.icon} size={18} color={colors.primary} />
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
                <Icon name={link.icon} size={18} color={colors.primary} />
                <Text style={styles.quickJumpLabel}>{link.label}</Text>
              </Pressable>
            ))
          )}
        </View>
      )}

      {isMobile && extrasReady && (
        <View
          testID="travel-details-primary-actions"
          accessibilityRole="none"
          accessibilityLabel="Поделиться маршрутом"
          style={[styles.sectionContainer, styles.contentStable, styles.shareButtonsContainer]}
        >
          <Suspense fallback={<View style={{ minHeight: 56 }} />}>
            <ShareButtons travel={travel} />
          </Suspense>
        </View>
      )}

      {!isMobile && extrasReady && (
        <View
          testID="travel-details-author"
          accessibilityRole="none"
          accessibilityLabel="Автор маршрута"
          style={[styles.sectionContainer, styles.contentStable, styles.authorCardContainer]}
        >
          <Text style={styles.sectionHeaderText}>Автор</Text>
          <Text style={styles.sectionSubtitle}>Профиль, соцсети и другие путешествия автора</Text>
          <View style={{ marginTop: 12 }}>
            <Suspense fallback={<View style={{ minHeight: 160 }} />}>
              <AuthorCard travel={travel} />
            </Suspense>
          </View>
        </View>
      )}
    </>
  )
}

// Re-export memoized versions under original names
export const OptimizedLCPHero = React.memo(OptimizedLCPHeroInner)
export const TravelHeroSection = React.memo(TravelHeroSectionInner as React.FC<any>)

export const __testables = {
  OptimizedLCPHero,
  useLCPPreload,
  TravelHeroSection,
}
