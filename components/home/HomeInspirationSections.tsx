import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'

import { ResponsiveContainer } from '@/components/layout'
import Button from '@/components/ui/Button'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { sendAnalyticsEvent } from '@/utils/analytics'
import AdventureChaptersSection from './AdventureChaptersSection'
import { createSectionsStyles } from './homeInspirationStyles'

const IS_WEB = Platform.OS === 'web'
const POINTER_EVENTS_NONE = { pointerEvents: 'none' } as const
const NAV_FEEDBACK_MS = 700

type QuickFilterValue = string | number | Array<string | number>
type QuickFilterParams = Record<string, QuickFilterValue | undefined>

function normalizeQuickFilterValue(value: QuickFilterValue | undefined): string | null {
  if (value == null) return null
  if (Array.isArray(value)) {
    const cleaned = value.map((x) => String(x ?? '').trim()).filter((x) => x.length > 0)
    return cleaned.length ? cleaned.join(',') : null
  }
  const scalar = String(value).trim()
  return scalar.length ? scalar : null
}

function buildFilterPath(base: string, params?: QuickFilterParams) {
  if (!params) return base
  const query = Object.entries(params)
    .map(([key, value]) => {
      const normalized = normalizeQuickFilterValue(value)
      return normalized ? `${key}=${normalized}` : null
    })
    .filter((x): x is string => !!x)
    .join('&')
  return query.length ? `${base}?${query}` : base
}

type GroupAccent = {
  base: string
  soft: string
  text: string
  gradient: [string, string]
}

type FilterChip = {
  label: string
  filters?: QuickFilterParams
  route?: string
}

type FilterGroup = {
  title: string
  icon: string
  accent: GroupAccent
  chips: FilterChip[]
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    title: 'Тип маршрута',
    icon: 'compass',
    accent: {
      base: '#2F6B4E',
      soft: 'rgba(47, 107, 78, 0.10)',
      text: '#1F4E37',
      gradient: ['#7BB07A', '#2F6B4E'],
    },
    chips: [
      { label: 'Поход / хайкинг', filters: { categories: [2, 21] } },
      { label: 'Город', filters: { categories: [19, 20] } },
      { label: 'Треккинг', filters: { categories: [22] } },
      { label: 'Велопоход', filters: { categories: [7] } },
      { label: 'Автопутешествие', filters: { categories: [6] } },
    ],
  },
  {
    title: 'Ночлег',
    icon: 'moon',
    accent: {
      base: '#5B3F8C',
      soft: 'rgba(91, 63, 140, 0.10)',
      text: '#3F2C66',
      gradient: ['#B59CD9', '#5B3F8C'],
    },
    chips: [
      { label: 'Без ночлега', filters: { over_nights_stay: [8] }, route: '/search' },
      { label: 'Палатка', filters: { over_nights_stay: [1] }, route: '/search' },
      { label: 'Гостиница', filters: { over_nights_stay: [2] }, route: '/search' },
      { label: 'Квартира / дом', filters: { over_nights_stay: [3, 4] }, route: '/search' },
    ],
  },
  {
    title: 'Сезон',
    icon: 'sun',
    accent: {
      base: '#A86A1F',
      soft: 'rgba(168, 106, 31, 0.10)',
      text: '#7A4D14',
      gradient: ['#F4B860', '#A86A1F'],
    },
    chips: [
      { label: 'Весна', filters: { month: [3, 4, 5] }, route: '/search' },
      { label: 'Лето', filters: { month: [6, 7, 8] }, route: '/search' },
      { label: 'Осень', filters: { month: [9, 10, 11] }, route: '/search' },
      { label: 'Зима', filters: { month: [12, 1, 2] }, route: '/search' },
    ],
  },
  {
    title: 'Что посмотреть',
    icon: 'eye',
    accent: {
      base: '#1F5C8A',
      soft: 'rgba(31, 92, 138, 0.10)',
      text: '#154566',
      gradient: ['#5BA8D6', '#1F5C8A'],
    },
    chips: [
      { label: 'Озеро', filters: { categoryTravelAddress: [84] }, route: '/search' },
      { label: 'Гора', filters: { categoryTravelAddress: [26] }, route: '/search' },
      { label: 'Водопад', filters: { categoryTravelAddress: [20] }, route: '/search' },
      { label: 'Замок', filters: { categoryTravelAddress: [43] }, route: '/search' },
    ],
  },
  {
    title: 'Расстояние на карте',
    icon: 'map-pin',
    accent: {
      base: '#C03A4A',
      soft: 'rgba(192, 58, 74, 0.10)',
      text: '#8E2A36',
      gradient: ['#FF7E7E', '#C03A4A'],
    },
    chips: [
      { label: 'До 30 км', filters: { radius: 30 }, route: '/map' },
      { label: 'До 60 км', filters: { radius: 60 }, route: '/map' },
      { label: 'До 100 км', filters: { radius: 100 }, route: '/map' },
      { label: 'До 200 км', filters: { radius: 200 }, route: '/map' },
    ],
  },
]

type Styles = ReturnType<typeof createSectionsStyles>

function buildAccentSelectedStyle(accent: GroupAccent) {
  return {
    backgroundColor: accent.base,
    borderColor: accent.base,
    ...Platform.select({
      web: {
        boxShadow: `0 6px 18px ${accent.base}40`,
        transform: 'translateY(-1px)',
      } as any,
    }),
  }
}

function buildAccentHoverStyle(accent: GroupAccent) {
  return { borderColor: accent.base, backgroundColor: accent.soft }
}

function buildAccentCardHoverStyle(accent: GroupAccent) {
  return {
    borderColor: accent.base,
    ...Platform.select({
      web: {
        boxShadow: `0 14px 32px ${accent.base}1F, 0 4px 10px rgba(0,0,0,0.05)`,
        transform: 'translateY(-3px)',
      } as any,
    }),
  } as any
}

function getCardPositionStyle(styles: Styles, idx: number) {
  if (idx === 3) return styles.filterGroupCardLastRowFirst
  if (idx === 4) return styles.filterGroupCardLastRowSecond
  return undefined
}

function FilterGroupCard({
  group,
  selectedChip,
  pendingChip,
  onChipPress,
  styles,
  isMobile,
  extraStyle,
}: {
  group: FilterGroup
  selectedChip: string | null
  pendingChip: string | null
  onChipPress: (label: string, filters?: QuickFilterParams, route?: string) => void
  styles: Styles
  isMobile: boolean
  extraStyle?: any
}) {
  const [hovered, setHovered] = useState(false)
  const accent = group.accent

  const accentSelectedStyle = useMemo(() => buildAccentSelectedStyle(accent), [accent])
  const accentHoverStyle = useMemo(() => buildAccentHoverStyle(accent), [accent])
  const cardHoverStyle = useMemo(() => buildAccentCardHoverStyle(accent), [accent])

  return (
    <View
      style={[styles.filterGroupCard, extraStyle, hovered && cardHoverStyle]}
      {...(IS_WEB
        ? ({
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
          } as any)
        : {})}
    >
      <View style={styles.filterGroupCardHeader}>
        <LinearGradient
          colors={accent.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.filterGroupIconWrap}
        >
          <Feather name={group.icon as any} size={18} color="#ffffff" />
        </LinearGradient>
        <Text style={styles.filterGroupTitleText}>{group.title}</Text>
      </View>
      <View style={[styles.chipsWrap, isMobile && styles.chipsWrapMobile]}>
        {group.chips.map((chip) => {
          const isSelected = selectedChip === chip.label
          const isPending = pendingChip === chip.label
          return (
            <Pressable
              key={chip.label}
              onPress={() => onChipPress(chip.label, chip.filters, chip.route)}
              disabled={isPending}
              style={({ pressed, hovered: chipHovered }) => [
                styles.chip,
                isMobile && styles.chipMobile,
                !isSelected && !isPending && (pressed || chipHovered) && accentHoverStyle,
                isSelected && accentSelectedStyle,
                isPending && accentSelectedStyle,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Фильтр ${chip.label}`}
              accessibilityState={{ selected: isSelected, busy: isPending, disabled: isPending }}
            >
              <Text style={[styles.chipText, (isSelected || isPending) && styles.chipTextSelected]}>
                {isPending ? 'Открываем...' : chip.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function HomeInspirationSections() {
  const router = useRouter()
  const { isPhone, isLargePhone } = useResponsive()
  const colors = useThemedColors()
  const isMobile = isPhone || isLargePhone
  const [selectedChip, setSelectedChip] = useState<string | null>(null)
  const [pendingChip, setPendingChip] = useState<string | null>(null)
  const [openingAllRoutes, setOpeningAllRoutes] = useState(false)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  const clearNavigationFeedbackLater = useCallback(() => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => {
      setPendingChip(null)
      setOpeningAllRoutes(false)
    }, NAV_FEEDBACK_MS)
  }, [])

  const handleFilterPress = useCallback(
    (label: string, filters?: QuickFilterParams, route?: string) => {
      sendAnalyticsEvent('HomeClick_QuickFilter', { label })
      setSelectedChip(label)
      setPendingChip(label)
      clearNavigationFeedbackLater()
      router.push(buildFilterPath(route ?? '/search', filters) as any)
    },
    [clearNavigationFeedbackLater, router],
  )

  const handleOpenArticles = useCallback(() => {
    sendAnalyticsEvent('HomeClick_OpenSearch', { source: 'home-filter-block' })
    setOpeningAllRoutes(true)
    clearNavigationFeedbackLater()
    router.push('/search' as any)
  }, [clearNavigationFeedbackLater, router])

  const styles = useMemo(() => createSectionsStyles(colors, isMobile), [colors, isMobile])

  return (
    <View style={[styles.band, isMobile && styles.bandMobile]}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={[styles.container, isMobile && styles.containerMobile]}>
          <View style={styles.quickFiltersSection}>
            <View style={[styles.quickFiltersAccentBlob1, POINTER_EVENTS_NONE]} />
            <View style={[styles.quickFiltersAccentBlob2, POINTER_EVENTS_NONE]} />

            <View style={styles.quickFiltersHeader}>
              <View style={styles.quickFiltersHeaderLeft}>
                <View style={styles.quickFiltersBadge}>
                  <Feather name="sliders" size={13} color={colors.primary} />
                  <Text style={styles.quickFiltersBadgeText}>Подбор по фильтрам</Text>
                </View>
                <Text style={styles.quickFiltersTitle}>
                  Выберите поездку{' '}
                  <Text style={styles.quickFiltersTitleAccent}>по своим параметрам</Text>
                </Text>
                <Text style={styles.quickFiltersSubtitle}>
                  Формат, сезон, ночлег и расстояние — нажмите, чтобы открыть подходящие маршруты
                </Text>
              </View>
              <Button
                label="Смотреть все маршруты"
                onPress={handleOpenArticles}
                loading={openingAllRoutes}
                icon={<Feather name="arrow-right" size={16} color="#ffffff" />}
                iconPosition="right"
                variant="primary"
                style={styles.quickFiltersArticlesButton}
                labelStyle={styles.quickFiltersArticlesText}
                hoverStyle={styles.quickFiltersArticlesButtonHover}
                pressedStyle={styles.quickFiltersArticlesButtonHover}
              />
            </View>

            <View style={styles.quickFiltersGrid}>
              {FILTER_GROUPS.map((group, idx) => (
                <FilterGroupCard
                  key={group.title}
                  group={group}
                  selectedChip={selectedChip}
                  pendingChip={pendingChip}
                  onChipPress={handleFilterPress}
                  styles={styles}
                  isMobile={isMobile}
                  extraStyle={getCardPositionStyle(styles, idx)}
                />
              ))}
            </View>
          </View>

          <AdventureChaptersSection />
        </View>
      </ResponsiveContainer>
    </View>
  )
}

export default memo(HomeInspirationSections)
