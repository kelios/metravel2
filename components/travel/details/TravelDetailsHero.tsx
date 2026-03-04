// E11: Refactored — state/logic extracted to useTravelHeroState hook
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import Feather from '@expo/vector-icons/Feather'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { useThemedColors } from '@/hooks/useTheme'
import { createSafeImageUrl } from '@/utils/travelDetailsSecure'
import { buildResponsiveImageProps, buildVersionedImageUrl } from '@/utils/imageOptimization'
import type { Travel } from '@/types/types'
import type { TravelSectionLink } from '@/components/travel/sectionLinks'
import type { AnchorsMap } from './TravelDetailsTypes'
import { useTravelDetailsStyles } from './TravelDetailsStyles'
import { withLazy } from './TravelDetailsLazy'
import { Icon } from './TravelDetailsIcons'
import { useTravelHeroState } from '@/hooks/useTravelHeroState'
// AND-28: Fullscreen gallery for native
const FullscreenGallery = Platform.OS !== 'web'
  ? React.lazy(() => import('@/components/travel/FullscreenGallery'))
  : () => null;

const Slider: React.FC<any> = withLazy(() => import('@/components/travel/Slider'))
const QuickFacts = withLazy(() => import('@/components/travel/QuickFacts'))
const AuthorCard = withLazy(() => import('@/components/travel/AuthorCard'))
const HERO_QUICK_JUMP_KEYS = ['description', 'map', 'points', 'comments', 'video'] as const
const QUICK_FACTS_PLACEHOLDER_STYLE = { minHeight: 72 } as const
const AUTHOR_PLACEHOLDER_STYLE = { minHeight: 160 } as const
const AUTHOR_WRAPPER_STYLE = { marginTop: 12 } as const

type ImgLike = { url: string; width?: number; height?: number; updated_at?: string | null; id?: number | string }

const buildVersioned = (url?: string, updated_at?: string | null, id?: any) =>
  createSafeImageUrl(url, updated_at, id)

const buildApiPrefixedUrl = (value: string): string | null => {
  try {
    const baseRaw = process.env.EXPO_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!/\/api\/?$/i.test(baseRaw)) return null
    const apiOrigin = baseRaw.replace(/\/api\/?$/, '')
    const parsed = new URL(value, apiOrigin)
    if (parsed.pathname.startsWith('/api/')) return null
    return `${apiOrigin}/api${parsed.pathname}${parsed.search}`
  } catch { return null }
}

/* ---- NeutralHeroPlaceholder ---- */
const NeutralHeroPlaceholder: React.FC<{ height?: number }> = ({ height }) => {
  const colors = useThemedColors()
  if (Platform.OS === 'web') {
    return <div style={{ width: '100%', height: height ? `${height}px` : '100%', borderRadius: 12, backgroundColor: colors.backgroundSecondary }} aria-hidden="true" />
  }
  return <View style={{ width: '100%', height, borderRadius: 12, backgroundColor: colors.backgroundSecondary }} />
}

/* ---- OptimizedLCPHeroInner ---- */
const OptimizedLCPHeroInner: React.FC<{ img: ImgLike; alt?: string; onLoad?: () => void; height?: number; isMobile?: boolean }> = ({ img, alt, onLoad, height, isMobile }) => {
  const [loadError, setLoadError] = useState(false)
  const [mainLoaded, setMainLoaded] = useState(false)
  const [mainLoadedSrc, setMainLoadedSrc] = useState<string | null>(null)
  const [overrideSrc, setOverrideSrc] = useState<string | null>(null)
  const [didTryApiPrefix, setDidTryApiPrefix] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const colors = useThemedColors()

  const baseSrc = buildVersionedImageUrl(buildVersioned(img.url, img.updated_at ?? null, img.id), img.updated_at ?? null, img.id)
  const ratio = img.width && img.height ? img.width / img.height : 16 / 9
  const lcpMaxWidth = isMobile ? 400 : 720
  const lcpWidths = isMobile ? [320, 400] : [480, 720]
  const targetWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth || lcpMaxWidth, lcpMaxWidth) : lcpMaxWidth

  const responsive = buildResponsiveImageProps(baseSrc, {
    maxWidth: targetWidth, widths: lcpWidths, quality: isMobile ? 35 : 45,
    format: 'auto', fit: 'contain', dpr: isMobile ? 1 : 1.5,
    sizes: isMobile ? '100vw' : '(max-width: 1024px) 92vw, 720px',
  })

  useEffect(() => {
    if (Platform.OS !== 'web') return
    const el = imgRef.current
    if (!el) return
    try { (el as any).fetchPriority = 'high'; el.setAttribute('fetchPriority', 'high') } catch { /* noop */ }
  }, [])

  const srcWithRetry = overrideSrc || responsive.src || baseSrc
  const fixedHeight = height ? `${Math.round(height)}px` : '100%'

  useEffect(() => { setMainLoaded(false); setMainLoadedSrc(null) }, [srcWithRetry])

  if (!srcWithRetry) return <NeutralHeroPlaceholder height={height} />

  if (Platform.OS !== 'web') {
    return (
      <View style={{ width: '100%', height: '100%' }}>
        {loadError ? <NeutralHeroPlaceholder height={height} /> : (
          <View style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }}>
            <ImageCardMedia src={srcWithRetry} fit="cover" blurBackground blurOnly blurRadius={12} cachePolicy="memory-disk" priority="low" style={StyleSheet.absoluteFill} borderRadius={12} />
            <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: colors.surfaceMuted }} />
            <ImageCardMedia src={srcWithRetry} fit="contain" blurBackground={false} cachePolicy="memory-disk" priority="high" borderRadius={12} imageProps={{ contentPosition: 'center' }} onLoad={() => { setLoadError(false); onLoad?.() }} onError={() => setLoadError(true)} style={{ width: '100%', height: '100%' }} />
          </View>
        )}
      </View>
    )
  }

  return (
    <div style={{ width: '100%', height: fixedHeight, ...(height ? { minHeight: fixedHeight } : null) }}>
      {loadError ? <NeutralHeroPlaceholder height={height} /> : (
        <div style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden', position: 'relative', backgroundColor: colors.backgroundSecondary }}>
          {!isMobile && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: '-5%',
                width: '110%',
                height: '110%',
                backgroundImage: mainLoaded && mainLoadedSrc ? `url("${mainLoadedSrc}")` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(20px)',
                zIndex: 0,
              }}
            />
          )}
          <img
            src={srcWithRetry} srcSet={responsive.srcSet} sizes={responsive.sizes}
            alt={alt || 'Фотография маршрута путешествия'}
            width={img.width || 1200} height={img.height || Math.round(1200 / ratio)}
            style={{ position: 'absolute', inset: 0, zIndex: 1, width: '100%', height: '100%', display: 'block', objectFit: 'contain', objectPosition: 'center' }}
            loading="eager" decoding="sync" fetchPriority="high"
            ref={imgRef as any} referrerPolicy="no-referrer-when-downgrade" data-lcp
            onLoad={(event) => { setMainLoadedSrc((event.currentTarget as HTMLImageElement)?.currentSrc || srcWithRetry); setMainLoaded(true); onLoad?.() }}
            onError={() => {
              if (!didTryApiPrefix) { const fallback = buildApiPrefixedUrl(srcWithRetry); if (fallback) { setDidTryApiPrefix(true); setOverrideSrc(fallback); return } setDidTryApiPrefix(true) }
              setLoadError(true)
              // Don't keep hero blocked on a failed cover image:
              // allow slider handoff immediately (gallery may still be valid).
              onLoad?.()
            }}
          />
        </div>
      )}
    </div>
  )
}

/* ---- TravelHeroSectionInner ---- */
function TravelHeroSectionInner({
  travel, anchors, isMobile, renderSlider = true, onFirstImageLoad, sectionLinks, onQuickJump, deferExtras = false,
}: {
  travel: Travel; anchors: AnchorsMap; isMobile: boolean; renderSlider?: boolean
  onFirstImageLoad: () => void; sectionLinks: TravelSectionLink[]; onQuickJump: (key: string) => void; deferExtras?: boolean
}) {
  const styles = useTravelDetailsStyles()
  const colors = useThemedColors()

  const {
    isFavorite, handleFavoriteToggle,
    firstImg, heroHeight, galleryImages, heroAlt, aspectRatio,
    setHeroContainerWidth, heroContainerWidth,
    webHeroLoaded, overlayUnmounted, isOverlayFading,
    handleWebHeroLoad, handleSliderImageLoad,
    extrasReady,
  } = useTravelHeroState(travel, isMobile, onFirstImageLoad, deferExtras)

  const shouldShowOptimizedHero = Platform.OS === 'web' && !!firstImg
  const favoriteButtonLabel = isFavorite ? 'В избранном' : 'В избранное'
  const favoriteButtonA11yLabel = isMobile
    ? favoriteButtonLabel
    : isFavorite
      ? 'Удалить из избранного'
      : 'Добавить в избранное'

  // AND-28: Fullscreen gallery state (native only)
  const [fullscreenVisible, setFullscreenVisible] = useState(false)
  const [fullscreenIndex, setFullscreenIndex] = useState(0)
  const handleImagePress = useCallback((index: number) => {
    if (Platform.OS === 'web') return
    setFullscreenIndex(index)
    setFullscreenVisible(true)
  }, [])
  const handleCloseFullscreen = useCallback(() => setFullscreenVisible(false), [])

  const quickJumpLinks = useMemo(() => {
    return HERO_QUICK_JUMP_KEYS.map((key) => sectionLinks.find((link) => link.key === key)).filter(Boolean) as TravelSectionLink[]
  }, [sectionLinks])

  return (
    <>
      <View
        testID="travel-details-hero" ref={anchors.gallery} accessibilityRole="none"
        accessibilityLabel="Геройский блок с изображением, заголовком и кнопкой избранного"
        {...(Platform.OS === 'web' ? { 'data-section-key': 'gallery' } : {})}
        style={[styles.sectionContainer, styles.contentStable, { marginBottom: 0 }]}
      >
        <View
          style={[styles.sliderContainer, { height: heroHeight }, Platform.OS === 'web' && ({ overflow: 'hidden' } as any)]}
          collapsable={false}
          onLayout={Platform.OS === 'web' ? undefined : (e: LayoutChangeEvent) => {
            const w = e.nativeEvent.layout.width
            if (w && Math.abs((heroContainerWidth ?? 0) - w) > 2) setHeroContainerWidth(w)
          }}
        >
          {!firstImg ? <NeutralHeroPlaceholder height={heroHeight} /> : Platform.OS === 'web' && shouldShowOptimizedHero ? (
            <>
              {webHeroLoaded && (
                <View style={{ position: 'absolute', inset: 0, zIndex: 1 } as any} collapsable={false}>
                  <Slider images={galleryImages} showArrows={!isMobile} hideArrowsOnMobile showDots={isMobile} autoPlay={false} preloadCount={0} blurBackground aspectRatio={aspectRatio as number} fillContainer fit="contain" onFirstImageLoad={handleSliderImageLoad} firstImagePreloaded={webHeroLoaded} onImagePress={handleImagePress} />
                </View>
              )}
              {!overlayUnmounted && (
                <View style={{ position: 'absolute', inset: 0, zIndex: 5, opacity: isOverlayFading ? 0 : 1, transition: 'opacity 320ms ease', pointerEvents: 'none' } as any} collapsable={false}>
                  <OptimizedLCPHeroInner img={{ url: firstImg.url, width: firstImg.width, height: firstImg.height, updated_at: firstImg.updated_at, id: firstImg.id }} alt={heroAlt} height={heroHeight} isMobile={isMobile} onLoad={handleWebHeroLoad} />
                </View>
              )}
            </>
          ) : (
            <View style={{ position: 'absolute', inset: 0 } as any} collapsable={false}>
              <Slider images={galleryImages} showArrows={!isMobile} hideArrowsOnMobile showDots={isMobile} autoPlay={false} preloadCount={Platform.OS === 'web' ? 0 : isMobile ? 1 : 2} blurBackground aspectRatio={aspectRatio as number} fillContainer fit="contain" onFirstImageLoad={onFirstImageLoad} firstImagePreloaded={renderSlider && Platform.OS === 'web'} onImagePress={handleImagePress} />
            </View>
          )}

          {travel?.name ? (
            <View style={[styles.heroOverlay, { pointerEvents: 'none' }]}>
              <View style={{ pointerEvents: 'auto' } as any}>
                <Text style={styles.heroTitle} numberOfLines={2} accessibilityRole="header">{travel.name}</Text>
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={handleFavoriteToggle}
            style={[styles.heroFavoriteBtn, isFavorite && styles.heroFavoriteBtnActive, isMobile && styles.heroFavoriteBtnMobile]}
            accessibilityRole="button" accessibilityLabel={favoriteButtonA11yLabel}
          >
            <Feather name="heart" size={20} color={isFavorite ? colors.textOnDark : 'rgba(255,255,255,0.9)'} />
            {isMobile && (
              <Text style={[styles.heroFavoriteBtnLabel, isFavorite && styles.heroFavoriteBtnLabelActive]}>
                {favoriteButtonLabel}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <View testID="travel-details-quick-facts" accessibilityRole="none" accessibilityLabel="Краткие факты" style={[styles.sectionContainer, styles.contentStable, styles.quickFactsContainer]}>
        {extrasReady ? <Suspense fallback={<View style={QUICK_FACTS_PLACEHOLDER_STYLE} />}><QuickFacts travel={travel} /></Suspense> : <View style={QUICK_FACTS_PLACEHOLDER_STYLE} />}
      </View>

      {quickJumpLinks.length > 0 && !extrasReady && <View style={[styles.sectionContainer, styles.contentStable, styles.quickJumpWrapper, { minHeight: 48 }]} />}
      {quickJumpLinks.length > 0 && extrasReady && (
        <View style={[styles.sectionContainer, styles.contentStable, styles.quickJumpWrapper]}>
          {isMobile ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickJumpScrollContent} style={styles.quickJumpScroll}>
              {quickJumpLinks.map((link) => (
                <Pressable key={link.key} onPress={() => onQuickJump(link.key)} style={({ pressed }) => [styles.quickJumpChip, pressed && styles.quickJumpChipPressed]} accessibilityRole="button" accessibilityLabel={`Перейти к разделу ${link.label}`}>
                  <Icon name={link.icon} size={16} color={colors.primary} /><Text style={styles.quickJumpLabel}>{link.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : quickJumpLinks.map((link) => (
            <Pressable key={link.key} onPress={() => onQuickJump(link.key)} style={({ pressed }) => [styles.quickJumpChip, pressed && styles.quickJumpChipPressed]} accessibilityRole="button" accessibilityLabel={`Перейти к разделу ${link.label}`}>
              <Icon name={link.icon} size={16} color={colors.primary} /><Text style={styles.quickJumpLabel}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!isMobile && extrasReady && (
        <View testID="travel-details-author" accessibilityRole="none" accessibilityLabel="Автор маршрута" style={[styles.sectionContainer, styles.contentStable, styles.authorCardContainer]}>
          <Text style={styles.sectionHeaderText}>Автор</Text>
          <Text style={styles.sectionSubtitle}>Профиль, соцсети и другие путешествия автора</Text>
          <View style={AUTHOR_WRAPPER_STYLE}>
            <Suspense fallback={<View style={AUTHOR_PLACEHOLDER_STYLE} />}><AuthorCard travel={travel} /></Suspense>
          </View>
        </View>
      )}

      {/* AND-28: Fullscreen gallery (native only) */}
      {Platform.OS !== 'web' && galleryImages.length > 0 && (
        <Suspense fallback={null}>
          <FullscreenGallery
            visible={fullscreenVisible}
            images={galleryImages.filter((img) => !!img.url).map((img) => ({ url: img.url! }))}
            initialIndex={fullscreenIndex}
            onClose={handleCloseFullscreen}
          />
        </Suspense>
      )}
    </>
  )
}

export const OptimizedLCPHero = React.memo(OptimizedLCPHeroInner)
export const TravelHeroSection = React.memo(TravelHeroSectionInner as React.FC<any>)
export const __testables = { OptimizedLCPHero, TravelHeroSection }
