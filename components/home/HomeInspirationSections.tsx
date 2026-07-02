import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'

import { ResponsiveContainer } from '@/components/layout'
import Button from '@/components/ui/Button'
import type { NavigationIconName } from '@/constants/navigationIcons'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { createSectionsStyles } from './homeInspirationStyles'

const NAV_FEEDBACK_MS = 700
// Extend the touch area of the quick-filter chips so the effective hit target
// clears 44px on phones without inflating the visual chip height.
const CHIP_HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 } as const

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

type FilterChip = {
  label: string
  filters?: QuickFilterParams
  route?: string
}

type FilterGroup = {
  title: string
  description: string
  icon: NavigationIconName
  chips: FilterChip[]
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    title: 'На выходные',
    description: 'Маршруты без долгого планирования',
    icon: 'calendar',
    chips: [
      { label: 'Без ночлега', filters: { over_nights_stay: [8] }, route: '/search' },
      { label: 'До 100 км', filters: { radius: 100 }, route: '/map' },
      { label: 'Лето', filters: { month: [6, 7, 8] }, route: '/search' },
    ],
  },
  {
    title: 'Рядом на карте',
    description: 'Идеи поблизости, если хочется уехать сегодня',
    icon: 'map-pin',
    chips: [
      { label: 'До 30 км', filters: { radius: 30 }, route: '/map' },
      { label: 'До 60 км', filters: { radius: 60 }, route: '/map' },
    ],
  },
  {
    title: 'Природа',
    description: 'Озера, горы и водопады в готовых маршрутах',
    icon: 'image',
    chips: [
      { label: 'Озеро', filters: { categoryTravelAddress: [84] }, route: '/search' },
      { label: 'Гора', filters: { categoryTravelAddress: [26] }, route: '/search' },
      { label: 'Водопад', filters: { categoryTravelAddress: [20] }, route: '/search' },
    ],
  },
  {
    title: 'Город и квесты',
    description: 'Прогулки, легенды и короткие городские маршруты',
    icon: 'quest-route',
    chips: [
      { label: 'Город', filters: { categories: [19, 20] }, route: '/search' },
      { label: 'Квесты', route: '/quests' },
      { label: 'Замок', filters: { categoryTravelAddress: [43] }, route: '/search' },
    ],
  },
]

type Styles = ReturnType<typeof createSectionsStyles>

// Flatten the curated groups into a single compact quick-filter strip: the home
// page already surfaces real content feeds, so the filter block is reduced to one
// row of shortcuts instead of four heavy cards.
const QUICK_FILTER_CHIPS: FilterChip[] = FILTER_GROUPS.flatMap((group) => group.chips)

function QuickFilterChips({
  selectedChip,
  pendingChip,
  onChipPress,
  styles,
  isMobile,
}: {
  selectedChip: string | null
  pendingChip: string | null
  onChipPress: (label: string, filters?: QuickFilterParams, route?: string) => void
  styles: Styles
  isMobile: boolean
}) {
  return (
    <View style={[styles.chipsWrap, isMobile && styles.chipsWrapMobile]}>
      {QUICK_FILTER_CHIPS.map((chip) => {
        const isSelected = selectedChip === chip.label
        const isPending = pendingChip === chip.label
        return (
          <Pressable
            key={chip.label}
            onPress={() => onChipPress(chip.label, chip.filters, chip.route)}
            hitSlop={CHIP_HIT_SLOP}
            disabled={isPending}
            style={({ pressed, hovered: chipHovered }) => [
              styles.chip,
              isMobile && styles.chipMobile,
              !isSelected && !isPending && (pressed || chipHovered) && styles.chipHover,
              isSelected && styles.chipSelected,
              isPending && styles.chipSelected,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Подбор ${chip.label}`}
            accessibilityState={{ selected: isSelected, busy: isPending, disabled: isPending }}
          >
            <Text style={[styles.chipText, (isSelected || isPending) && styles.chipTextSelected]}>
              {isPending ? 'Открываем...' : chip.label}
            </Text>
          </Pressable>
        )
      })}
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
            <View style={styles.quickFiltersHeader}>
              <View style={styles.quickFiltersHeaderLeft}>
                <View style={styles.quickFiltersBadge}>
                  <Feather name="sliders" size={13} color={colors.primaryDark} />
                  <Text style={styles.quickFiltersBadgeText}>Быстрый подбор</Text>
                </View>
                <Text style={styles.quickFiltersTitle}>
                  Найдите маршрут под свой день
                </Text>
                <Text style={styles.quickFiltersSubtitle}>
                  Выберите сценарий — откроем поездки, квесты или карту рядом.
                </Text>
              </View>
              <Button
                label="Открыть каталог"
                onPress={handleOpenArticles}
                loading={openingAllRoutes}
                icon={<Feather name="arrow-right" size={16} color={colors.primaryText} />}
                iconPosition="right"
                variant="secondary"
                style={styles.quickFiltersArticlesButton}
                labelStyle={styles.quickFiltersArticlesText}
                hoverStyle={styles.quickFiltersArticlesButtonHover}
                pressedStyle={styles.quickFiltersArticlesButtonHover}
              />
            </View>

            <QuickFilterChips
              selectedChip={selectedChip}
              pendingChip={pendingChip}
              onChipPress={handleFilterPress}
              styles={styles}
              isMobile={isMobile}
            />
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  )
}

export default memo(HomeInspirationSections)
