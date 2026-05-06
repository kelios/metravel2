import React, { memo, useCallback, useMemo, useState } from 'react'
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

type QuickFilterValue = string | number | Array<string | number>
type QuickFilterParams = Record<string, QuickFilterValue | undefined>

const normalizeQuickFilterValue = (
  value: QuickFilterValue | undefined,
): string | null => {
  if (value === undefined || value === null) return null

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0)
    if (!cleaned.length) return null
    return cleaned.join(',')
  }

  const scalar = String(value).trim()
  return scalar.length > 0 ? scalar : null
}

const buildFilterPath = (base: string, params?: QuickFilterParams) => {
  if (!params) return base

  const query = Object.entries(params)
    .map(([key, value]) => {
      const normalized = normalizeQuickFilterValue(value)
      if (!normalized) return null
      return `${key}=${normalized}`
    })
    .filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    )
    .join('&')

  return query.length > 0 ? `${base}?${query}` : base
}

type GroupAccent = {
  base: string
  soft: string
  text: string
  gradient: [string, string]
}

const FILTER_GROUPS: Array<{
  title: string
  icon: string
  accent: GroupAccent
  chips: Array<{
    label: string
    filters?: QuickFilterParams
    route?: string
  }>
}> = [
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

function FilterGroupCard({
  group,
  selectedChip,
  onChipPress,
  styles,
  isMobile,
  extraStyle,
}: {
  group: (typeof FILTER_GROUPS)[number]
  selectedChip: string | null
  onChipPress: (
    label: string,
    filters?: QuickFilterParams,
    route?: string,
  ) => void
  styles: ReturnType<typeof createSectionsStyles>
  isMobile: boolean
  extraStyle?: any
}) {
  const [hovered, setHovered] = useState(false)
  const isWeb = Platform.OS === 'web'

  const accent = group.accent
  const accentSelectedStyle = {
    backgroundColor: accent.base,
    borderColor: accent.base,
    ...Platform.select({
      web: {
        boxShadow: `0 6px 18px ${accent.base}40`,
        transform: 'translateY(-1px)',
      } as any,
    }),
  }
  const accentHoverStyle = {
    borderColor: accent.base,
    backgroundColor: accent.soft,
  }

  return (
    <View
      style={[
        styles.filterGroupCard,
        extraStyle,
        hovered &&
          ({
            borderColor: accent.base,
            ...Platform.select({
              web: {
                boxShadow: `0 14px 32px ${accent.base}1F, 0 4px 10px rgba(0,0,0,0.05)`,
                transform: 'translateY(-3px)',
              } as any,
            }),
          } as any),
      ]}
      {...(isWeb
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
          return (
            <Pressable
              key={chip.label}
              onPress={() =>
                onChipPress(
                  chip.label,
                  (chip as any).filters,
                  (chip as any).route,
                )
              }
              style={({ pressed, hovered: chipHovered }) => [
                styles.chip,
                isMobile && styles.chipMobile,
                !isSelected && (pressed || chipHovered) && accentHoverStyle,
                isSelected && accentSelectedStyle,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Фильтр ${chip.label}`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected,
                ]}
              >
                {chip.label}
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
  const [btnHovered, setBtnHovered] = useState(false)
  const isWeb = Platform.OS === 'web'

  const handleFilterPress = useCallback(
    (label: string, filters?: QuickFilterParams, route?: string) => {
      sendAnalyticsEvent('HomeClick_QuickFilter', { label })
      setSelectedChip(label)
      const base = route ?? '/search'
      const path = buildFilterPath(base, filters)
      router.push(path as any)
    },
    [router],
  )

  const handleOpenArticles = useCallback(() => {
    sendAnalyticsEvent('HomeClick_OpenSearch', { source: 'home-filter-block' })
    router.push('/search' as any)
  }, [router])

  const styles = useMemo(
    () => createSectionsStyles(colors, isMobile),
    [colors, isMobile],
  )

  return (
    <View style={[styles.band, isMobile && styles.bandMobile]}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={[styles.container, isMobile && styles.containerMobile]}>
          <View style={styles.quickFiltersSection}>
            <View
              style={[
                styles.quickFiltersAccentBlob1,
                { pointerEvents: 'none' },
              ]}
            />
            <View
              style={[
                styles.quickFiltersAccentBlob2,
                { pointerEvents: 'none' },
              ]}
            />

            <View style={styles.quickFiltersHeader}>
              <View style={styles.quickFiltersHeaderLeft}>
                <View style={styles.quickFiltersBadge}>
                  <Feather name="sliders" size={13} color={colors.primary} />
                  <Text style={styles.quickFiltersBadgeText}>Умный подбор</Text>
                </View>
                <Text style={styles.quickFiltersTitle}>
                  Подберите поездку{' '}
                  <Text style={styles.quickFiltersTitleAccent}>
                    под свой ритм
                  </Text>
                </Text>
                <Text style={styles.quickFiltersSubtitle}>
                  Комбинируйте формат, сезон и расстояние — мы соберём идеальный
                  маршрут
                </Text>
              </View>
              <Button
                label="Смотреть все маршруты"
                onPress={handleOpenArticles}
                icon={<Feather name="arrow-right" size={16} color="#ffffff" />}
                iconPosition="right"
                variant="primary"
                style={[
                  styles.quickFiltersArticlesButton,
                  btnHovered && styles.quickFiltersArticlesButtonHover,
                ]}
                labelStyle={styles.quickFiltersArticlesText}
                hoverStyle={styles.quickFiltersArticlesButtonHover}
                pressedStyle={styles.quickFiltersArticlesButtonHover}
                {...(isWeb
                  ? ({
                      onMouseEnter: () => setBtnHovered(true),
                      onMouseLeave: () => setBtnHovered(false),
                    } as any)
                  : {})}
              />
            </View>

            <View style={styles.quickFiltersGrid}>
              {FILTER_GROUPS.map((group, idx) => (
                <FilterGroupCard
                  key={group.title}
                  group={group}
                  selectedChip={selectedChip}
                  onChipPress={handleFilterPress}
                  styles={styles}
                  isMobile={isMobile}
                  extraStyle={
                    idx === 3
                      ? styles.filterGroupCardLastRowFirst
                      : idx === 4
                        ? styles.filterGroupCardLastRowSecond
                        : undefined
                  }
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
