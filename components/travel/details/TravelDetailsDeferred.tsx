import React, {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ActivityIndicator,
  Animated,
  InteractionManager,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import NavigationArrows from '@/components/travel/NavigationArrows'
import ShareButtons from '@/components/travel/ShareButtons'
import TelegramDiscussionSection from '@/components/travel/TelegramDiscussionSection'
import CTASection from '@/components/travel/CTASection'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { METRICS } from '@/constants/layout'
import { useLazyMap } from '@/hooks/useLazyMap'
import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'
import { useThemedColors } from '@/hooks/useTheme'
import { getAccessibilityLabel } from '@/utils/a11y'
import { safeGetYoutubeId } from '@/utils/travelDetailsSecure'
import {
  DescriptionSkeleton,
  MapSkeleton,
  PointListSkeleton,
  TravelListSkeleton,
} from '@/components/travel/TravelDetailSkeletons'
import type { Travel } from '@/src/types/types'

import type { AnchorsMap } from './TravelDetailsTypes'
import { useTravelDetailsStyles } from './TravelDetailsStyles'
import { withLazy } from './TravelDetailsLazy'
import { Icon } from './TravelDetailsIcons'

/* -------------------- lazy imports (второстепенные) -------------------- */
const TravelDescription = withLazy(() => import('@/components/travel/TravelDescription'))
const PointList = withLazy(() => import('@/components/travel/PointList'))
const NearTravelList = withLazy(() => import('@/components/travel/NearTravelList'))
const PopularTravelList = withLazy(() => import('@/components/travel/PopularTravelList'))
const ToggleableMap = withLazy(() => import('@/components/travel/ToggleableMapSection'))
const MapClientSide = withLazy(() => import('@/components/Map'))

const WebViewComponent =
  Platform.OS === 'web'
    ? (() => null) as React.ComponentType<any>
    : withLazy(() =>
        import('react-native-webview').then((m: any) => ({
          default: m.default ?? m.WebView,
        }))
      )

const BelkrajWidgetComponent =
  Platform.OS === 'web'
    ? withLazy(() => import('@/components/belkraj/BelkrajWidget'))
    : (() => null) as React.ComponentType<any>

// Обёртка для ленивой загрузки секции "Экскурсии" (Belkraj) по скроллу на web
const ExcursionsLazySection: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const containerRef = useRef<any>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setVisible(true)
      return
    }

    if (visible) return
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      setVisible(true)
      return
    }

    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }

    const rawNode = containerRef.current as any
    const targetNode = rawNode?._nativeNode || rawNode?._domNode || rawNode || null
    if (!targetNode) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry && entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      {
        root: null,
        rootMargin: '200px 0px 0px 0px',
        threshold: 0.1,
      }
    )

    observer.observe(targetNode as Element)

    return () => {
      observer.disconnect()
    }
  }, [visible])

  if (Platform.OS !== 'web') {
    return <>{children}</>
  }

  return (
    <View ref={containerRef} collapsable={false}>
      {visible ? children : null}
    </View>
  )
}

const Fallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="small" />
    </View>
  )
}

const DescriptionFallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <DescriptionSkeleton />
    </View>
  )
}

const MapFallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <MapSkeleton />
    </View>
  )
}

const PointListFallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <PointListSkeleton />
    </View>
  )
}

const TravelListFallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.travelListFallback}>
      <TravelListSkeleton count={3} />
    </View>
  )
}

const getYoutubeId = safeGetYoutubeId

const rIC = (cb: () => void, timeout = 300) => {
  if (typeof (window as any)?.requestIdleCallback === 'function') {
    ;(window as any).requestIdleCallback(cb, { timeout })
  } else {
    setTimeout(cb, timeout)
  }
}

/* -------------------- Collapsible section -------------------- */
const CollapsibleSection: React.FC<{
  title: string
  initiallyOpen?: boolean
  forceOpen?: boolean
  iconName?: string
  highlight?: 'default' | 'positive' | 'negative' | 'info'
  badgeLabel?: string
  open?: boolean
  onToggle?: (next: boolean) => void
  children: React.ReactNode
}> = memo(
  ({
    title,
    initiallyOpen = false,
    forceOpen = false,
    iconName,
    highlight = 'default',
    badgeLabel,
    open: controlledOpen,
    onToggle,
    children,
  }) => {
    const styles = useTravelDetailsStyles()
    const colors = useThemedColors()
    const isControlled = typeof controlledOpen === 'boolean'
    const [internalOpen, setInternalOpen] = useState(initiallyOpen)
    const open = isControlled ? (controlledOpen as boolean) : internalOpen

    useEffect(() => {
      if (forceOpen) {
        if (isControlled) {
          onToggle?.(true)
        } else {
          setInternalOpen(true)
        }
      }
    }, [forceOpen, isControlled, onToggle])

    const handleToggle = useCallback(() => {
      if (isControlled) {
        onToggle?.(!controlledOpen)
      } else {
        setInternalOpen((o) => !o)
      }
    }, [controlledOpen, isControlled, onToggle])

    return (
      <View style={[styles.sectionContainer, styles.contentStable]} collapsable={false}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={handleToggle}
          style={[
            styles.sectionHeaderBtn,
            highlight === 'positive' && styles.sectionHeaderPositive,
            highlight === 'negative' && styles.sectionHeaderNegative,
            highlight === 'info' && styles.sectionHeaderInfo,
            open && styles.sectionHeaderActive,
          ]}
          hitSlop={10}
          accessibilityLabel={getAccessibilityLabel(title, `${open ? 'Expanded' : 'Collapsed'}`)}
        >
          <View style={styles.sectionHeaderTitleWrap}>
            {iconName && (
              <View style={styles.sectionHeaderIcon}>
                <Icon name={iconName} size={18} color={colors.primary} />
              </View>
            )}
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
          <View style={styles.sectionHeaderRight}>
            {badgeLabel && <Text style={styles.sectionHeaderBadge}>{badgeLabel}</Text>}
            <Icon name={open ? 'expand-less' : 'expand-more'} size={22} />
          </View>
        </TouchableOpacity>
        {open ? <View style={{ marginTop: 12 }}>{children}</View> : null}
      </View>
    )
  }
)

/* -------------------- Lazy YouTube -------------------- */
const LazyYouTube: React.FC<{ url: string }> = ({ url }) => {
  const styles = useTravelDetailsStyles()
  const colors = useThemedColors()
  const id = useMemo(() => getYoutubeId(url), [url])
  const [mounted, setMounted] = useState(false)
  const [shouldAutoplay, setShouldAutoplay] = useState(false)

  const embedUrl = useMemo(() => {
    if (!id) return null
    const params = [
      `autoplay=${shouldAutoplay ? 1 : 0}`,
      `mute=${shouldAutoplay ? 1 : 0}`,
      'playsinline=1',
      'rel=0',
      'modestbranding=1',
    ].join('&')
    return `https://www.youtube.com/embed/${id}?${params}`
  }, [id, shouldAutoplay])

  const handlePreviewPress = useCallback(() => {
    setMounted(true)
    setShouldAutoplay(true)
  }, [])

  if (!id) return null

  if (!mounted) {
    return (
      <Pressable
        onPress={handlePreviewPress}
        style={styles.videoContainer}
        accessibilityRole="button"
        accessibilityLabel="Смотреть видео"
      >
        <ImageCardMedia
          src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
          fit="contain"
          blurBackground
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
          borderRadius={DESIGN_TOKENS.radii.md}
        />
        <View style={styles.playOverlay}>
          <Icon name="play-circle-fill" size={64} color={colors.textOnDark} />
          <Text style={styles.videoHintText}>Видео запустится автоматически</Text>
        </View>
      </Pressable>
    )
  }

  return Platform.OS === 'web' ? (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: colors.text,
        contain: 'layout style paint' as any,
      }}
    >
      <iframe
        src={embedUrl ?? undefined}
        width="100%"
        height="100%"
        style={{ border: 'none', display: 'block' }}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        title="YouTube video"
      />
    </div>
  ) : (
    <Suspense fallback={<Fallback />}>
      <View style={styles.videoContainer}>
        <WebViewComponent
          source={{ uri: embedUrl ?? `https://www.youtube.com/embed/${id}` }}
          style={{ flex: 1 }}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
        />
      </View>
    </Suspense>
  )
}

export const TravelDeferredSections: React.FC<{
  travel: Travel
  isMobile: boolean
  forceOpenKey: string | null
  anchors: AnchorsMap
  relatedTravels: Travel[]
  setRelatedTravels: React.Dispatch<React.SetStateAction<Travel[]>>
  scrollY: Animated.Value
  viewportHeight: number
  scrollRef: any
}> = ({
  travel,
  isMobile,
  forceOpenKey,
  anchors,
  relatedTravels,
  setRelatedTravels,
  scrollY,
  viewportHeight,
  scrollRef,
}) => {
  const [canRenderHeavy, setCanRenderHeavy] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web') {
      const task = InteractionManager.runAfterInteractions(() => setCanRenderHeavy(true))
      return () => task.cancel()
    }
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web') {
      rIC(() => {
        setCanRenderHeavy(true)
      }, 1200)
    }
  }, [])

  return (
    <>
      <TravelContentSections
        travel={travel}
        isMobile={isMobile}
        anchors={anchors}
        forceOpenKey={forceOpenKey}
        scrollRef={scrollRef}
      />

      <TravelVisualSections travel={travel} anchors={anchors} canRenderHeavy={canRenderHeavy} />

      <TravelRelatedContent
        travel={travel}
        anchors={anchors}
        relatedTravels={relatedTravels}
        setRelatedTravels={setRelatedTravels}
        scrollY={scrollY}
        viewportHeight={viewportHeight}
      />

      <TravelEngagementSection travel={travel} isMobile={isMobile} />
    </>
  )
}

const TravelContentSections: React.FC<{
  travel: Travel
  isMobile: boolean
  anchors: AnchorsMap
  forceOpenKey: string | null
  scrollRef: any
}> = ({ travel, isMobile, anchors, forceOpenKey, scrollRef }) => {
  const styles = useTravelDetailsStyles()
  const colors = useThemedColors()
  type InsightKey = 'recommendation' | 'plus' | 'minus'

  const stripHtml = useCallback((value?: string | null) => {
    if (!value) return ''
    return value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }, [])

  const extractSnippets = useCallback(
    (value?: string | null, maxSentences = 1) => {
      const text = stripHtml(value)
      if (!text) return ''
      const matches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []
      const parts = matches.map((p) => p.trim()).filter(Boolean)
      return parts.slice(0, Math.max(1, maxSentences)).join(' ')
    },
    [stripHtml]
  )

  const hasRecommendation = Boolean(travel.recommendation?.trim())
  const hasPlus = Boolean(travel.plus?.trim())
  const hasMinus = Boolean(travel.minus?.trim())

  const insightConfigs = useMemo(
    () =>
      [
        hasRecommendation && {
          key: 'recommendation' as InsightKey,
          label: 'Советы',
        },
        hasPlus && {
          key: 'plus' as InsightKey,
          label: 'Понравилось',
        },
        hasMinus && {
          key: 'minus' as InsightKey,
          label: 'Не зашло',
        },
      ].filter(Boolean) as Array<{ key: InsightKey; label: string }>,
    [hasRecommendation, hasPlus, hasMinus]
  )

  const shouldUseMobileInsights = isMobile && insightConfigs.length > 0
  const [mobileInsightKey, setMobileInsightKey] = useState<InsightKey | null>(() =>
    shouldUseMobileInsights ? insightConfigs[0]?.key ?? null : null
  )

  const defaultInsightKey = shouldUseMobileInsights ? insightConfigs[0]?.key ?? null : null

  useEffect(() => {
    if (!shouldUseMobileInsights) {
      if (mobileInsightKey !== null) {
        setMobileInsightKey(null)
      }
      return
    }

    if (
      forceOpenKey &&
      (forceOpenKey === 'recommendation' || forceOpenKey === 'plus' || forceOpenKey === 'minus')
    ) {
      if (mobileInsightKey !== forceOpenKey) {
        setMobileInsightKey(forceOpenKey as InsightKey)
      }
      return
    }

    if (!mobileInsightKey && defaultInsightKey) {
      setMobileInsightKey(defaultInsightKey)
    }
  }, [defaultInsightKey, forceOpenKey, mobileInsightKey, shouldUseMobileInsights])

  const buildInsightControl = useCallback(
    (key: InsightKey) =>
      shouldUseMobileInsights
        ? {
            open: mobileInsightKey === key,
            onToggle: () => setMobileInsightKey((prev) => (prev === key ? null : key)),
          }
        : {},
    [mobileInsightKey, shouldUseMobileInsights]
  )

  const decisionSummary = useMemo(() => {
    const items: Array<{ label: string; text: string; tone: 'info' | 'positive' | 'negative' }> = []
    const rec = extractSnippets(travel.recommendation, 2)
    const plus = extractSnippets(travel.plus, 1)
    const minus = extractSnippets(travel.minus, 1)

    if (rec) items.push({ label: 'Полезно', text: rec, tone: 'info' })
    if (plus) items.push({ label: 'Плюс', text: plus, tone: 'positive' })
    if (minus) items.push({ label: 'Минус', text: minus, tone: 'negative' })

    return items.slice(0, 3)
  }, [extractSnippets, travel.minus, travel.plus, travel.recommendation])

  const decisionTips = useMemo(() => {
    type TipItem = { text: string; level: 0 | 1 }

    const splitToBullets = (text: string): TipItem[] => {
      const normalized = text
        .replace(/\r\n/g, '\n')
        .replace(/(&nbsp;|&#160;)/gi, ' ')
        .replace(/\u00a0/g, ' ')
        .replace(/\u2022/g, '•')
        .replace(/\s+/g, ' ')
        .trim()

      const withListBreaks = normalized
        .replace(/\s+(?=\d{1,2}\s*[).]\s+)/g, '\n')
        .replace(/\s+(?=[-–—]\s+)/g, '\n')

      const lines = withListBreaks
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)

      const items: TipItem[] = []

      const pushOrAppend = (level: 0 | 1, value: string) => {
        const v = value.trim()
        if (!v) return
        if (level === 0) {
          items.push({ text: v, level: 0 })
          return
        }
        items.push({ text: v, level: 1 })
      }

      const splitInlineSubBullets = (mainText: string): { main: string; subs: string[] } => {
        const cleaned = mainText.trim()
        if (!cleaned) return { main: '', subs: [] }

        const parts = cleaned
          .split(/\s+[-–—]\s+/g)
          .map((p) => p.trim())
          .filter(Boolean)

        if (parts.length <= 1) return { main: cleaned, subs: [] }
        return { main: parts[0] ?? '', subs: parts.slice(1) }
      }

      let inNumbered = false

      for (const lineRaw of lines) {
        const line = lineRaw.replace(/^•\s*/, '').trim()
        const numberedMatch = line.match(/^(\d{1,2})\s*[).]\s+(.*)$/)

        if (numberedMatch) {
          inNumbered = true
          const rest = (numberedMatch[2] ?? '').trim()
          const { main, subs } = splitInlineSubBullets(rest)
          pushOrAppend(0, main)
          subs.forEach((s) => pushOrAppend(1, s))
          continue
        }

        const subMatch = line.match(/^[-–—]\s+(.*)$/)
        if (subMatch) {
          pushOrAppend(1, subMatch[1] ?? '')
          continue
        }

        if (inNumbered && items.length > 0) {
          const idxFromEnd = [...items].reverse().findIndex((x) => x.level === 0)
          if (idxFromEnd !== -1) {
            const absoluteIndex = items.length - 1 - idxFromEnd
            items[absoluteIndex] = {
              ...items[absoluteIndex],
              text: `${items[absoluteIndex].text} ${line}`.trim(),
            }
            continue
          }
        }

        const fromSemicolons = line
          .split(/\s*;\s+/g)
          .map((s) => s.trim())
          .filter(Boolean)

        if (fromSemicolons.length > 1) {
          fromSemicolons.forEach((s) => pushOrAppend(0, s))
          continue
        }

        const sentences = line
          .split(/(?<=[.!?])\s+/g)
          .map((s) => s.trim())
          .filter(Boolean)

        sentences.forEach((s) => pushOrAppend(0, s))
      }

      return items
    }

    const tips = decisionSummary
      .flatMap((item) => splitToBullets(item.text))
      .map((t) => ({ ...t, text: t.text.replace(/^[-–—•]\s*/, '').trim() }))
      .filter((t) => Boolean(t.text))

    return tips.slice(0, 8)
  }, [decisionSummary])

  return (
    <>
      {travel.description && (
        <Suspense fallback={<DescriptionFallback />}>
          <View
            ref={anchors.description}
            collapsable={false}
            accessibilityLabel="Описание маршрута"
            {...(Platform.OS === 'web' ? { 'data-section-key': 'description' } : {})}
          >
            <CollapsibleSection
              title={travel.name}
              initiallyOpen
              forceOpen={forceOpenKey === 'description'}
              iconName="menu-book"
              highlight="info"
            >
              <View style={styles.descriptionContainer}>
                <View style={styles.descriptionIntroWrapper}>
                  <Text style={styles.descriptionIntroTitle}>Описание маршрута</Text>
                  <Text style={styles.descriptionIntroText}>
                    {`${travel.number_days || 0} ${
                      travel.number_days === 1
                        ? 'день'
                        : travel.number_days < 5
                        ? 'дня'
                        : 'дней'
                    }`}
                    {travel.countryName ? ` · ${travel.countryName}` : ''}
                    {travel.monthName ? ` · лучший сезон: ${travel.monthName.toLowerCase()}` : ''}
                  </Text>
                </View>

                {decisionTips.length > 0 && (
                  <View style={styles.decisionSummaryBox}>
                    <Text style={styles.decisionSummaryTitle}>Полезные советы перед поездкой</Text>
                    <View style={styles.decisionSummaryList}>
                      {decisionTips.map((tip, idx) =>
                        tip.level === 0 ? (
                          <View key={`tip-${idx}`} style={styles.decisionSummaryBulletRow}>
                            <MaterialIcons
                              name="lightbulb-outline"
                              size={14}
                              color={colors.textMuted}
                              style={styles.decisionSummaryBulletIcon}
                              accessibilityElementsHidden
                            />
                            <Text style={styles.decisionSummaryBulletText}>{tip.text}</Text>
                          </View>
                        ) : (
                          <View key={`tip-${idx}`} style={styles.decisionSummarySubBulletRow}>
                            <MaterialIcons
                              name="circle"
                              size={6}
                              color={colors.textMuted}
                              style={styles.decisionSummarySubBulletIcon}
                              accessibilityElementsHidden
                            />
                            <Text style={styles.decisionSummarySubBulletText}>{tip.text}</Text>
                          </View>
                        )
                      )}
                    </View>
                  </View>
                )}

                <TravelDescription title={travel.name} htmlContent={travel.description} noBox />
                {Platform.OS === 'web' && (
                  <Pressable
                    onPress={() => {
                      try {
                        const scrollViewAny = scrollRef.current as any
                        const node: any =
                          (typeof scrollViewAny?.getScrollableNode === 'function' &&
                            scrollViewAny.getScrollableNode()) ||
                          scrollViewAny?._scrollNode ||
                          scrollViewAny?._innerViewNode ||
                          scrollViewAny?._nativeNode ||
                          scrollViewAny?._domNode ||
                          null

                        if (node) {
                          const before = Number(node.scrollTop ?? 0)
                          let didCall = false
                          try {
                            if (typeof node.scrollTo === 'function') {
                              node.scrollTo({ top: 0, behavior: 'smooth' })
                              didCall = true
                            }
                          } catch {
                            // noop
                          }

                          try {
                            const afterObj = Number(node.scrollTop ?? 0)
                            if (
                              typeof node.scrollTo === 'function' &&
                              (!didCall || Math.abs(afterObj - before) < 1)
                            ) {
                              node.scrollTo(0, 0)
                              didCall = true
                            }
                          } catch {
                            // noop
                          }

                          try {
                            const afterNum = Number(node.scrollTop ?? 0)
                            if (!didCall || Math.abs(afterNum - before) < 1) {
                              node.scrollTop = 0
                            }
                          } catch {
                            // noop
                          }
                          return
                        }
                      } catch {
                        // noop
                      }

                      if (typeof window !== 'undefined') {
                        try {
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        } catch {
                          try {
                            window.scrollTo(0, 0)
                          } catch {
                            // noop
                          }
                        }
                      }
                    }}
                    style={styles.backToTopWrapper}
                    accessibilityRole="button"
                    accessibilityLabel="Назад к началу страницы"
                  >
                    <Text style={styles.backToTopText}>Назад к началу</Text>
                  </Pressable>
                )}
              </View>
            </CollapsibleSection>
          </View>
        </Suspense>
      )}

      {travel.youtube_link && (
        <View
          style={[styles.sectionContainer, styles.contentStable]}
          ref={anchors.video}
          collapsable={false}
          accessibilityLabel="Видео маршрута"
          {...(Platform.OS === 'web' ? { 'data-section-key': 'video' } : {})}
        >
          <Text style={styles.sectionHeaderText}>Видео</Text>
          <Text style={styles.sectionSubtitle}>Одно нажатие — и ролик начнёт проигрываться</Text>
          <View style={{ marginTop: 12 }}>
            <LazyYouTube url={travel.youtube_link} />
          </View>
        </View>
      )}

      {shouldUseMobileInsights && (
        <View
          accessibilityLabel="Быстрый доступ к разделам"
          style={[styles.sectionContainer, styles.mobileInsightTabsWrapper]}
        >
          <Text style={styles.mobileInsightLabel}>Быстрый доступ к разделам</Text>
          <View style={styles.mobileInsightTabs}>
            {insightConfigs.map((section) => (
              <Pressable
                key={section.key}
                onPress={() => setMobileInsightKey(section.key)}
                style={[
                  styles.mobileInsightChip,
                  mobileInsightKey === section.key && styles.mobileInsightChipActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Показать раздел ${section.label}`}
              >
                <Text
                  style={[
                    styles.mobileInsightChipText,
                    mobileInsightKey === section.key && styles.mobileInsightChipTextActive,
                  ]}
                >
                  {section.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {travel.recommendation && (
        <Suspense fallback={<DescriptionFallback />}>
          <View
            ref={anchors.recommendation}
            collapsable={false}
            accessibilityLabel="Рекомендации"
            {...(Platform.OS === 'web' ? { 'data-section-key': 'recommendation' } : {})}
          >
            <CollapsibleSection
              title="Рекомендации"
              initiallyOpen={!isMobile}
              forceOpen={!isMobile && forceOpenKey === 'recommendation'}
              iconName="tips-and-updates"
              highlight="info"
              badgeLabel="Опыт автора"
              {...buildInsightControl('recommendation')}
            >
              <View style={styles.descriptionContainer}>
                <TravelDescription title="Рекомендации" htmlContent={travel.recommendation} noBox />
              </View>
            </CollapsibleSection>
          </View>
        </Suspense>
      )}

      {travel.plus && (
        <Suspense fallback={<DescriptionFallback />}>
          <View
            ref={anchors.plus}
            collapsable={false}
            accessibilityLabel="Плюсы"
            {...(Platform.OS === 'web' ? { 'data-section-key': 'plus' } : {})}
          >
            <CollapsibleSection
              title="Плюсы"
              initiallyOpen={!isMobile}
              forceOpen={!isMobile && forceOpenKey === 'plus'}
              iconName="thumb-up-alt"
              highlight="positive"
              badgeLabel="Что понравилось"
              {...buildInsightControl('plus')}
            >
              <View style={styles.descriptionContainer}>
                <TravelDescription title="Плюсы" htmlContent={travel.plus} noBox />
              </View>
            </CollapsibleSection>
          </View>
        </Suspense>
      )}

      {travel.minus && (
        <Suspense fallback={<DescriptionFallback />}>
          <View
            ref={anchors.minus}
            collapsable={false}
            accessibilityLabel="Минусы"
            {...(Platform.OS === 'web' ? { 'data-section-key': 'minus' } : {})}
          >
            <CollapsibleSection
              title="Минусы"
              initiallyOpen={!isMobile}
              forceOpen={!isMobile && forceOpenKey === 'minus'}
              iconName="thumb-down-alt"
              highlight="negative"
              badgeLabel="Что смутило"
              {...buildInsightControl('minus')}
            >
              <View style={styles.descriptionContainer}>
                <TravelDescription title="Минусы" htmlContent={travel.minus} noBox />
              </View>
            </CollapsibleSection>
          </View>
        </Suspense>
      )}
    </>
  )
}

const TravelVisualSections: React.FC<{
  travel: Travel
  anchors: AnchorsMap
  canRenderHeavy: boolean
}> = ({ travel, anchors, canRenderHeavy }) => {
  const styles = useTravelDetailsStyles()
  const { width } = useWindowDimensions()
  const hasMapData = (travel.coordsMeTravel?.length ?? 0) > 0
  const { shouldLoad: shouldLoadMap, setElementRef } = useLazyMap({ enabled: Platform.OS === 'web' })
  const shouldRenderMap = canRenderHeavy && (Platform.OS !== 'web' || shouldLoadMap) && hasMapData
  const [hasMountedMap, setHasMountedMap] = useState(false)

  useEffect(() => {
    if (shouldRenderMap && !hasMountedMap) {
      setHasMountedMap(true)
    }
  }, [shouldRenderMap, hasMountedMap])

  const shouldMountMap = hasMapData && (hasMountedMap || shouldRenderMap)

  const isMobileWeb = Platform.OS === 'web' && width <= METRICS.breakpoints.tablet

  return (
    <>
      {Platform.OS === 'web' && (travel.travelAddress?.length ?? 0) > 0 && (
        <Suspense fallback={<Fallback />}>
          <ExcursionsLazySection>
            <View
              ref={anchors.excursions}
              style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
              collapsable={false}
              accessibilityLabel="Экскурсии"
              {...(Platform.OS === 'web' ? { 'data-section-key': 'excursions' } : {})}
            >
              <Text style={styles.sectionHeaderText}>Экскурсии</Text>
              <Text style={styles.sectionSubtitle}>Покажем экскурсии рядом с точками маршрута</Text>

              <View style={{ marginTop: 12, minHeight: 600 }}>
                <BelkrajWidgetComponent
                  countryCode={travel.countryCode}
                  points={travel.travelAddress as any}
                  collapsedHeight={600}
                />
              </View>
            </View>
          </ExcursionsLazySection>
        </Suspense>
      )}

      <View
        ref={anchors.map}
        testID="travel-details-map"
        style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
        collapsable={false}
        accessibilityLabel="Карта маршрута"
        {...(Platform.OS === 'web' ? { 'data-section-key': 'map', 'data-map-for-pdf': '1' } : {})}
      >
        {Platform.OS === 'web' && (
          <View
            collapsable={false}
            // @ts-ignore - ref callback for RNW
            ref={(node: any) => {
              const target = node?._nativeNode || node?._domNode || node || null
              setElementRef(target as any)
            }}
          />
        )}
        <Text style={styles.sectionHeaderText}>Карта маршрута</Text>
        <Text style={styles.sectionSubtitle}>Посмотрите последовательность точек на живой карте</Text>
        <View style={{ marginTop: 12 }}>
          {hasMapData ? (
            <ToggleableMap
              initiallyOpen={!isMobileWeb}
              keepMounted
              isLoading={!shouldRenderMap}
              loadingLabel="Подгружаем карту маршрута..."
            >
              {shouldMountMap ? (
                <Suspense fallback={<MapFallback />}>
                  <MapClientSide travel={{ data: travel.travelAddress as any }} />
                </Suspense>
              ) : null}
            </ToggleableMap>
          ) : (
            <View style={styles.mapEmptyState}>
              <Text style={styles.mapEmptyText}>Маршрут ещё не добавлен</Text>
            </View>
          )}
        </View>
      </View>

      <View
        ref={anchors.points}
        testID="travel-details-points"
        style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
        collapsable={false}
        accessibilityLabel="Координаты мест"
        {...(Platform.OS === 'web' ? { 'data-section-key': 'points' } : {})}
      >
        <Text style={styles.sectionHeaderText}>Координаты мест</Text>
        <View style={{ marginTop: 12 }}>
          {travel.travelAddress && (
            <Suspense fallback={<PointListFallback />}>
              <PointList points={travel.travelAddress as any} baseUrl={travel.url} />
            </Suspense>
          )}
        </View>
      </View>
    </>
  )
}

const TravelRelatedContent: React.FC<{
  travel: Travel
  anchors: AnchorsMap
  relatedTravels: Travel[]
  setRelatedTravels: React.Dispatch<React.SetStateAction<Travel[]>>
  scrollY: Animated.Value
  viewportHeight: number
}> = ({ travel, anchors, relatedTravels, setRelatedTravels, scrollY, viewportHeight }) => {
  const styles = useTravelDetailsStyles()
  const isWeb = Platform.OS === 'web'
  const preloadMargin = 200

  const { shouldLoad: shouldLoadNearWeb, setElementRef: setNearRefWeb } = useProgressiveLoad({
    priority: 'low',
    rootMargin: `${preloadMargin}px`,
    threshold: 0.1,
    fallbackDelay: 1500,
  })
  const { shouldLoad: shouldLoadPopularWeb, setElementRef: setPopularRefWeb } = useProgressiveLoad({
    priority: 'low',
    rootMargin: `${preloadMargin}px`,
    threshold: 0.1,
    fallbackDelay: 1500,
  })

  const [nearTop, setNearTop] = useState<number | null>(null)
  const [popularTop, setPopularTop] = useState<number | null>(null)
  const [shouldLoadNearNative, setShouldLoadNearNative] = useState(false)
  const [shouldLoadPopularNative, setShouldLoadPopularNative] = useState(false)

  useEffect(() => {
    if (isWeb) return
    if (!viewportHeight || viewportHeight <= 0) return

    const id = scrollY.addListener(({ value }) => {
      const bottomY = value + viewportHeight + preloadMargin

      if (nearTop != null) {
        const nextNear = bottomY >= nearTop
        setShouldLoadNearNative((prev) => (prev === nextNear ? prev : nextNear))
      }

      if (popularTop != null) {
        const nextPopular = bottomY >= popularTop
        setShouldLoadPopularNative((prev) => (prev === nextPopular ? prev : nextPopular))
      }
    })

    return () => {
      scrollY.removeListener(id)
    }
  }, [isWeb, nearTop, popularTop, preloadMargin, scrollY, viewportHeight])

  const shouldLoadNear = isWeb ? shouldLoadNearWeb : shouldLoadNearNative
  const shouldLoadPopular = isWeb ? shouldLoadPopularWeb : shouldLoadPopularNative

  const [hasLoadedNear, setHasLoadedNear] = useState(false)
  const [hasLoadedPopular, setHasLoadedPopular] = useState(false)

  useEffect(() => {
    if (shouldLoadNear && !hasLoadedNear) setHasLoadedNear(true)
  }, [shouldLoadNear, hasLoadedNear])

  useEffect(() => {
    if (shouldLoadPopular && !hasLoadedPopular) setHasLoadedPopular(true)
  }, [shouldLoadPopular, hasLoadedPopular])

  const shouldRenderNear = shouldLoadNear || hasLoadedNear
  const shouldRenderPopular = shouldLoadPopular || hasLoadedPopular

  const [canMountNear, setCanMountNear] = useState(false)
  const [canMountPopular, setCanMountPopular] = useState(false)

  useEffect(() => {
    if (!shouldRenderNear || canMountNear) return
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof (window as any).requestIdleCallback === 'function'
    ) {
      const id = (window as any).requestIdleCallback(() => setCanMountNear(true), { timeout: 1200 })
      return () => {
        try {
          ;(window as any).cancelIdleCallback?.(id)
        } catch {
          // noop
        }
      }
    }

    const task = InteractionManager.runAfterInteractions(() => setCanMountNear(true))
    return () => task.cancel()
  }, [shouldRenderNear, canMountNear])

  useEffect(() => {
    if (!shouldRenderPopular || canMountPopular) return
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof (window as any).requestIdleCallback === 'function'
    ) {
      const id = (window as any).requestIdleCallback(() => setCanMountPopular(true), { timeout: 1200 })
      return () => {
        try {
          ;(window as any).cancelIdleCallback?.(id)
        } catch {
          // noop
        }
      }
    }

    const task = InteractionManager.runAfterInteractions(() => setCanMountPopular(true))
    return () => task.cancel()
  }, [shouldRenderPopular, canMountPopular])

  return (
    <>
      <View
        ref={anchors.near}
        style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
        collapsable={false}
        accessibilityLabel="Рядом можно посмотреть"
        onLayout={
          isWeb
            ? undefined
            : (e: LayoutChangeEvent) => {
                const y = e.nativeEvent.layout.y
                setNearTop((prev) => (prev === y ? prev : y))
              }
        }
        {...(Platform.OS === 'web' ? { 'data-section-key': 'near' } : {})}
      >
        {Platform.OS === 'web' ? (
          <View
            collapsable={false}
            // @ts-ignore - ref callback for RNW
            ref={(node: any) => {
              const target = node?._nativeNode || node?._domNode || node || null
              setNearRefWeb(target)
            }}
          />
        ) : (
          <View />
        )}
        <Text style={styles.sectionHeaderText}>Рядом можно посмотреть</Text>
        <Text style={styles.sectionSubtitle}>Маршруты в радиусе ~60 км</Text>
        <View style={{ marginTop: 8 }}>
          {travel.travelAddress &&
            (shouldRenderNear && canMountNear ? (
              <View testID="travel-details-near-loaded">
                <Suspense fallback={<TravelListFallback />}>
                  <NearTravelList
                    travel={travel}
                    onTravelsLoaded={(travels) => setRelatedTravels(travels)}
                    showHeader={false}
                    embedded
                  />
                </Suspense>
              </View>
            ) : (
              <View testID="travel-details-near-placeholder" style={styles.lazySectionReserved}>
                <TravelListSkeleton count={3} />
              </View>
            ))}
        </View>
      </View>

      {relatedTravels.length > 0 && (
        <View
          style={[styles.sectionContainer, styles.navigationArrowsContainer]}
          accessibilityLabel="Навигация по похожим маршрутам"
        >
          <NavigationArrows currentTravel={travel} relatedTravels={relatedTravels} />
        </View>
      )}

      <View
        ref={anchors.popular}
        style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
        collapsable={false}
        accessibilityLabel="Популярные маршруты"
        onLayout={
          isWeb
            ? undefined
            : (e: LayoutChangeEvent) => {
                const y = e.nativeEvent.layout.y
                setPopularTop((prev) => (prev === y ? prev : y))
              }
        }
        {...(Platform.OS === 'web' ? { 'data-section-key': 'popular' } : {})}
      >
        {Platform.OS === 'web' ? (
          <View
            collapsable={false}
            // @ts-ignore - ref callback for RNW
            ref={(node: any) => {
              const target = node?._nativeNode || node?._domNode || node || null
              setPopularRefWeb(target)
            }}
          />
        ) : (
          <View />
        )}
        <Text style={styles.sectionHeaderText}>Популярные маршруты</Text>
        <Text style={styles.sectionSubtitle}>Самые просматриваемые направления за неделю</Text>
        <View style={{ marginTop: 8 }}>
          {shouldRenderPopular && canMountPopular ? (
            <View testID="travel-details-popular-loaded">
              <Suspense fallback={<TravelListFallback />}>
                <PopularTravelList title={null} showHeader={false} embedded />
              </Suspense>
            </View>
          ) : (
            <View testID="travel-details-popular-placeholder" style={styles.lazySectionReserved}>
              <TravelListSkeleton count={3} />
            </View>
          )}
        </View>
      </View>
    </>
  )
}

export const TravelEngagementSection: React.FC<{ travel: Travel; isMobile: boolean }> = ({
  travel,
  isMobile,
}) => {
  const styles = useTravelDetailsStyles()

  return (
    <>
      <View
        testID="travel-details-telegram"
        accessibilityLabel="Обсуждение в Telegram"
        style={[styles.sectionContainer, styles.authorCardContainer, styles.webDeferredSection]}
      >
        <TelegramDiscussionSection travel={travel} />
      </View>

      {!isMobile && (
        <View
          testID="travel-details-share"
          accessibilityLabel="Поделиться маршрутом"
          style={[styles.sectionContainer, styles.shareButtonsContainer, styles.webDeferredSection]}
        >
          <ShareButtons travel={travel} />
        </View>
      )}

      <View
        testID="travel-details-cta"
        accessibilityLabel="Призыв к действию"
        style={[styles.sectionContainer, styles.ctaContainer, styles.webDeferredSection]}
      >
        <CTASection travel={travel} />
      </View>
    </>
  )
}
