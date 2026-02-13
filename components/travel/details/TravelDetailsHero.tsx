import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import Feather from '@expo/vector-icons/Feather'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { useThemedColors } from '@/hooks/useTheme'
import { useResponsive } from '@/hooks/useResponsive'
import { useFavorites } from '@/context/FavoritesContext'
import { useAuth } from '@/context/AuthContext'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { showToast } from '@/utils/toast'
import {
  createSafeImageUrl,
} from '@/utils/travelDetailsSecure'
import {
  buildResponsiveImageProps,
  buildVersionedImageUrl,
} from '@/utils/imageOptimization'
import type { Travel } from '@/types/types'
import type { TravelSectionLink } from '@/components/travel/sectionLinks'

import type { AnchorsMap } from './TravelDetailsTypes'
import { useTravelDetailsStyles } from './TravelDetailsStyles'
import { withLazy } from './TravelDetailsLazy'
import { Icon } from './TravelDetailsIcons'
import { useTdTrace } from '@/hooks/useTdTrace'

const Slider: React.FC<any> = withLazy(() => import('@/components/travel/Slider'))
const QuickFacts = withLazy(() => import('@/components/travel/QuickFacts'))
const AuthorCard = withLazy(() => import('@/components/travel/AuthorCard'))
const HERO_QUICK_JUMP_KEYS = ['description', 'map', 'points', 'comments', 'video'] as const
const QUICK_FACTS_PLACEHOLDER_STYLE = { minHeight: 72 } as const
const AUTHOR_PLACEHOLDER_STYLE = { minHeight: 160 } as const
const AUTHOR_WRAPPER_STYLE = { marginTop: 12 } as const

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
          backgroundColor: colors.backgroundSecondary,
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
  const [mainLoaded, setMainLoaded] = useState(false)
  const [overrideSrc, setOverrideSrc] = useState<string | null>(null)
  const [didTryApiPrefix, setDidTryApiPrefix] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема
  const baseSrc = buildVersionedImageUrl(
    buildVersioned(img.url, img.updated_at ?? null, img.id),
    img.updated_at ?? null,
    img.id
  )
  const ratio = img.width && img.height ? img.width / img.height : 16 / 9
  const lcpMaxWidth = isMobile ? 400 : 720
  const lcpWidths = isMobile ? [320, 400] : [480, 720]
  const targetWidth =
    typeof window !== 'undefined'
      ? Math.min(window.innerWidth || lcpMaxWidth, lcpMaxWidth)
      : lcpMaxWidth
  const lcpQuality = isMobile ? 35 : 45

  const responsive = buildResponsiveImageProps(baseSrc, {
    maxWidth: targetWidth,
    widths: lcpWidths,
    quality: lcpQuality,
    format: 'auto',
    fit: 'contain',
    dpr: isMobile ? 1 : 1.5,
    sizes: isMobile
      ? '100vw'
      : '(max-width: 1024px) 92vw, 720px',
  })

  useEffect(() => {
    if (Platform.OS !== 'web') return
    const el = imgRef.current
    if (!el) return
    try {
      ;(el as any).fetchPriority = 'high'
      el.setAttribute('fetchPriority', 'high')
    } catch {
      // noop
    }
  }, [])

  const srcWithRetry = overrideSrc || responsive.src || baseSrc
  const fixedHeight = height ? `${Math.round(height)}px` : '100%'

  // ✅ Keep a stable box size to avoid CLS on web.
  const ratioInv = useMemo(() => {
    const r = img.width && img.height ? img.width / img.height : 16 / 9
    return r > 0 ? 100 / r : 56.25
  }, [img.width, img.height])

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
          {/* Reserve space inside to prevent micro shifts while image decodes */}
          <div aria-hidden="true" style={{ width: '100%', height: 0, paddingTop: `${ratioInv}%` }} />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: '-5%',
              width: '110%',
              height: '110%',
              backgroundImage: mainLoaded ? `url("${srcWithRetry}")` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(20px)',
              zIndex: 0,
            }}
          />
          <img
            src={srcWithRetry}
            srcSet={responsive.srcSet}
            sizes={responsive.sizes}
            alt={alt || 'Фотография маршрута путешествия'}
            width={img.width || 1200}
            height={img.height || Math.round(1200 / ratio)}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'contain',
            }}
            loading="eager"
            decoding="sync"
            // @ts-ignore
            fetchPriority="high"
            // @ts-ignore
            ref={imgRef as any}
            referrerPolicy="no-referrer-when-downgrade"
            data-lcp
            onLoad={() => {
              setMainLoaded(true)
              onLoad?.()
            }}
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
  const { width: winW, height: winH } = useResponsive()
  const [heroContainerWidth, setHeroContainerWidth] = useState<number | null>(null)
  const [extrasReady, setExtrasReady] = useState(!deferExtras || Platform.OS !== 'web')

  const tdTrace = useTdTrace()

  const { isAuthenticated } = useAuth()
  const { requireAuth } = useRequireAuth({ intent: 'favorite' })
  const { addFavorite, removeFavorite, isFavorite: checkIsFavorite } = useFavorites()
  const isFavorite = checkIsFavorite(travel.id, 'travel')

  useEffect(() => {
    tdTrace('hero:mount', { travelId: travel?.id })
    return () => tdTrace('hero:unmount', { travelId: travel?.id })
  }, [tdTrace, travel?.id])

  const handleFavoriteToggle = useCallback(async () => {
    if (!isAuthenticated) {
      requireAuth()
      return
    }
    try {
      if (isFavorite) {
        await removeFavorite(travel.id, 'travel')
        showToast({ type: 'success', text1: 'Удалено из избранного', visibilityTime: 2000 })
      } else {
        await addFavorite({
          id: travel.id,
          type: 'travel',
          title: travel.name,
          imageUrl: travel.travel_image_thumb_url,
          url: `/travels/${(travel as any).slug || travel.id}`,
          country: (travel as any).countryName,
        })
        showToast({ type: 'success', text1: 'Добавлено в избранное', visibilityTime: 2000 })
      }
    } catch {
      showToast({ type: 'error', text1: 'Не удалось обновить избранное', visibilityTime: 3000 })
    }
  }, [isAuthenticated, requireAuth, isFavorite, travel, addFavorite, removeFavorite])

  const heroMetaLine = useMemo(() => {
    const parts: string[] = []
    const countryName = (travel as any).countryName || ''
    const numberDays = (travel as any).number_days
    const monthName = (travel as any).monthName || ''
    const year = (travel as any).year

    if (countryName) parts.push(countryName)
    if (numberDays != null && Number.isFinite(Number(numberDays))) {
      const d = Number(numberDays)
      parts.push(`${d} ${d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'}`)
    }
    const when = [monthName, year].filter(Boolean).join(' ')
    if (when) parts.push(when)
    return parts.join(' \u00B7 ')
  }, [travel])

  // Keep hero LCP source aligned with Slider first frame to avoid visible swap flicker.
  const firstRaw = travel?.travel_image_thumb_url || travel?.gallery?.[0]
  const firstImg = useMemo(() => {
    if (!firstRaw) return null
    if (typeof firstRaw === 'string') return { url: firstRaw }
    return firstRaw
  }, [firstRaw]) as ImgLike | null

  useEffect(() => {
    if (!firstImg?.url) return
    tdTrace('hero:firstImgReady')
  }, [firstImg?.url, tdTrace])

  const aspectRatio =
    (firstImg?.width && firstImg?.height ? firstImg.width / firstImg.height : undefined) || 16 / 9
  const resolvedWidth = heroContainerWidth ?? winW
  const heroHeight = useMemo(() => {
    // 70% высоты экрана для всех платформ
    const target = winH * 0.7
    if (Platform.OS === 'web' && !isMobile) return Math.max(320, Math.min(target, winH * 0.75))
    if (!resolvedWidth) return isMobile ? Math.max(280, target) : Math.max(320, target)
    if (isMobile) {
      return Math.max(280, Math.min(target, winH * 0.75))
    }
    return Math.max(320, Math.min(target, winH * 0.75))
  }, [isMobile, winH, resolvedWidth])
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
  // renderSlider is kept for API compatibility; on web we always mount Slider and overlay LCP image.

  // ✅ Web: keep a stable LCP hero image, then swap to Slider after it's loaded.
  const isJSDOM =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    String((navigator as any).userAgent || '').toLowerCase().includes('jsdom')
  const [webHeroLoaded, setWebHeroLoaded] = useState(Platform.OS !== 'web' || isJSDOM)
  // Keep LCP overlay visible until the Slider's first image actually loads
  const [overlayUnmounted, setOverlayUnmounted] = useState(false)
  const [isOverlayFading, setIsOverlayFading] = useState(false)
  const [sliderImageReady, setSliderImageReady] = useState(false)
  const webHeroLoadNotifiedRef = useRef(false)
  const sliderLoadNotifiedRef = useRef(false)
  const lastTravelIdRef = useRef<number | string | null>(travel?.id ?? null)

  useEffect(() => {
    if (Platform.OS !== 'web') return
    const nextTravelId = (travel?.id as any) ?? null
    const prevTravelId = lastTravelIdRef.current
    const isFirstRun = prevTravelId === null

    if (!isFirstRun && prevTravelId !== nextTravelId) {
      // Reset swap state only when route/travel actually changes.
      // URL normalization of the same image should not trigger a visual restart.
      setWebHeroLoaded(false)
      setOverlayUnmounted(false)
      setIsOverlayFading(false)
      setSliderImageReady(false)
      webHeroLoadNotifiedRef.current = false
      sliderLoadNotifiedRef.current = false
      tdTrace('hero:swapReset')
    }

    lastTravelIdRef.current = nextTravelId
  }, [travel?.id, tdTrace])

  // After Slider's first image loads, hide the LCP overlay
  useEffect(() => {
    if (!webHeroLoaded || Platform.OS !== 'web') return
    if (sliderImageReady) {
      setIsOverlayFading(true)
      // Image loaded — after opacity transition completes, unmount overlay.
      const t = setTimeout(() => setOverlayUnmounted(true), 340)
      return () => clearTimeout(t)
    }
    // Safety fallback: remove overlay after 6s even if slider image hasn't loaded
    const fallback = setTimeout(() => {
      setIsOverlayFading(true)
      setOverlayUnmounted(true)
    }, 6000)
    return () => clearTimeout(fallback)
  }, [webHeroLoaded, sliderImageReady])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (webHeroLoaded) tdTrace('hero:webHeroLoaded')
  }, [webHeroLoaded, tdTrace])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (overlayUnmounted) tdTrace('hero:overlayHidden')
  }, [overlayUnmounted, tdTrace])

  const handleWebHeroLoad = useCallback(() => {
    if (webHeroLoadNotifiedRef.current) return
    webHeroLoadNotifiedRef.current = true
    if (Platform.OS === 'web') setWebHeroLoaded(true)
    tdTrace('hero:lcpImg:onLoad')
    onFirstImageLoad()
  }, [onFirstImageLoad, tdTrace])

  const handleSliderImageLoad = useCallback(() => {
    if (sliderLoadNotifiedRef.current) return
    sliderLoadNotifiedRef.current = true
    setSliderImageReady(true)
    tdTrace('hero:sliderImgLoaded')
  }, [tdTrace])

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
      {/* P0: Hero-изображение, заголовок и кнопка «В избранное» */}
      <View
        testID="travel-details-hero"
        ref={anchors.gallery}
        accessibilityRole="none"
        accessibilityLabel="Геройский блок с изображением, заголовком и кнопкой избранного"
        {...(Platform.OS === 'web' ? { 'data-section-key': 'gallery' } : {})}
        style={[styles.sectionContainer, styles.contentStable]}
      >
        <View
          style={[
            styles.sliderContainer,
            { height: heroHeight },
            Platform.OS === 'web' && ({ overflow: 'hidden' } as any),
          ]}
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
          ) : Platform.OS === 'web' && shouldShowOptimizedHero ? (
            // Web: defer heavy Slider (imports reanimated) until after LCP image loads.
            // Before LCP: render only the lightweight <img> hero (OptimizedLCPHeroInner).
            // After LCP: mount the Slider underneath, keep overlay briefly, then fade out.
            <View style={{ width: '100%', height: '100%' } as any} collapsable={false}>
              {webHeroLoaded && (
                <Slider
                  images={galleryImages}
                  showArrows={!isMobile}
                  hideArrowsOnMobile
                  showDots={isMobile}
                  autoPlay={false}
                  preloadCount={0}
                  blurBackground
                  aspectRatio={aspectRatio as number}
                  mobileHeightPercent={0.7}
                  onFirstImageLoad={handleSliderImageLoad}
                  firstImagePreloaded
                />
              )}
              {!overlayUnmounted && (
                <View
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 5,
                    opacity: isOverlayFading ? 0 : 1,
                    transition: 'opacity 320ms ease',
                    pointerEvents: 'none',
                  } as any}
                  collapsable={false}
                >
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
                    onLoad={handleWebHeroLoad}
                  />
                </View>
              )}
            </View>
          ) : (
            <Slider
              images={galleryImages}
              showArrows={!isMobile}
              hideArrowsOnMobile
              showDots={isMobile}
              autoPlay={false}
              preloadCount={Platform.OS === 'web' ? 0 : isMobile ? 1 : 2}
              blurBackground
              aspectRatio={aspectRatio as number}
              mobileHeightPercent={0.7}
              onFirstImageLoad={onFirstImageLoad}
              firstImagePreloaded={renderSlider && Platform.OS === 'web'}
            />
          )}

          {/* P0-1: Видимый заголовок поверх hero-изображения */}
          {travel?.name ? (
            <View style={[styles.heroOverlay, { pointerEvents: 'box-none' }]}>
              <Text
                style={styles.heroTitle}
                numberOfLines={2}
                accessibilityRole="header"
              >
                {travel.name}
              </Text>
              {heroMetaLine ? (
                <Text style={styles.heroMeta} numberOfLines={1}>
                  {heroMetaLine}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* P1-1: Кнопка «В избранное» в hero */}
          <Pressable
            onPress={handleFavoriteToggle}
            style={[
              styles.heroFavoriteBtn,
              isFavorite && styles.heroFavoriteBtnActive,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
          >
            <Feather
              name="heart"
              size={22}
              color={isFavorite ? colors.textOnDark : 'rgba(255,255,255,0.9)'}
            />
          </Pressable>
        </View>
      </View>

      <View
        testID="travel-details-quick-facts"
        accessibilityRole="none"
        accessibilityLabel="Краткие факты"
        style={[styles.sectionContainer, styles.contentStable, styles.quickFactsContainer]}
      >
        {extrasReady ? (
          <Suspense fallback={<View style={QUICK_FACTS_PLACEHOLDER_STYLE} />}>
            <QuickFacts travel={travel} />
          </Suspense>
        ) : (
          <View style={QUICK_FACTS_PLACEHOLDER_STYLE} />
        )}
      </View>

      {/* 4.3: WeatherWidget перенесён в TravelDetailsMapSection */}

      {quickJumpLinks.length > 0 && !extrasReady && (
        <View style={[styles.sectionContainer, styles.contentStable, styles.quickJumpWrapper, { minHeight: 48 }]} />
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
                  <Icon name={link.icon} size={16} color={colors.primary} />
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
                <Icon name={link.icon} size={16} color={colors.primary} />
                <Text style={styles.quickJumpLabel}>{link.label}</Text>
              </Pressable>
            ))
          )}
        </View>
      )}

      {/* P0-2: AuthorCard показывается только на desktop в hero.
         На mobile — перенесён после контента (TravelDetailsDeferred). */}
      {!isMobile && extrasReady && (
        <View
          testID="travel-details-author"
          accessibilityRole="none"
          accessibilityLabel="Автор маршрута"
          style={[styles.sectionContainer, styles.contentStable, styles.authorCardContainer]}
        >
          <Text style={styles.sectionHeaderText}>Автор</Text>
          <Text style={styles.sectionSubtitle}>Профиль, соцсети и другие путешествия автора</Text>
          <View style={AUTHOR_WRAPPER_STYLE}>
            <Suspense fallback={<View style={AUTHOR_PLACEHOLDER_STYLE} />}>
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
  TravelHeroSection,
}
