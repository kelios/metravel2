import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { useAuth } from '@/context/AuthContext'
import { useFavorites } from '@/context/FavoritesContext'
import { useTravelStatusStore, type TravelStatus, type TravelStatusEntry } from '@/stores/travelStatusStore'
import EmptyState from '@/components/ui/EmptyState'
import TabTravelCard from '@/components/listTravel/TabTravelCard'
import ProfileCollectionHeader from '@/components/profile/ProfileCollectionHeader'
import MiniCalendar from '@/components/calendar/MiniCalendar'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { globalFocusStyles } from '@/styles/globalFocus'
import { buildLoginHref } from '@/utils/authNavigation'
import { webTouchScrollStyle } from '@/utils'
import { buildCanonicalUrl } from '@/utils/seo'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { cleanTravelTitle } from '@/utils/cleanTravelTitle'

const TABS: Array<{ key: TravelStatus; label: string; icon: React.ComponentProps<typeof Feather>['name'] }> = [
  { key: 'visited', label: 'Был', icon: 'check-circle' },
  { key: 'planned', label: 'Планирую', icon: 'calendar' },
  { key: 'wishlist', label: 'Хочу', icon: 'bookmark' },
]

const EMPTY_STATE: Record<TravelStatus, { icon: string; title: string; description: string; actionLabel: string }> = {
  visited: {
    icon: 'check-circle',
    title: 'Нет посещённых мест',
    description: 'Открой любое путешествие и нажми «Добавить в план» → «Был здесь».',
    actionLabel: 'Найти путешествия',
  },
  planned: {
    icon: 'calendar',
    title: 'Нет запланированных поездок',
    description: 'Открой любое путешествие, нажми «Добавить в план» → «Планирую» и ��ыбери дату.',
    actionLabel: 'Найти маршрут',
  },
  wishlist: {
    icon: 'bookmark',
    title: 'Список желаний пуст',
    description: 'Добавляй путешествия в избранное ❤️ или открой путешествие и нажми «Добавить в план» → «Хочу поехать».',
    actionLabel: 'Найти маршруты',
  },
}

const BADGE_COLORS: Record<TravelStatus, string> = {
  visited: '#22c55e',
  planned: '#3b82f6',
  wishlist: '#f59e0b',
}

// Универсальный тип для карточек в списке
type DisplayEntry = TravelStatusEntry & { _isFavorite?: boolean }

export default function CalendarScreen() {
  const router = useRouter()
  const canonical = buildCanonicalUrl('/calendar')
  const { isAuthenticated, authReady, userId } = useAuth()
  const colors = useThemedColors()
  const { favorites } = useFavorites()

  const { loadLocal, getByStatus, entries } = useTravelStatusStore()

  const [activeTab, setActiveTab] = useState<TravelStatus>('planned')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Загружаем локальное хранилище
  useEffect(() => {
    if (!authReady || !isAuthenticated) return
    loadLocal(userId).finally(() => setIsLoading(false))
  }, [authReady, isAuthenticated, userId, loadLocal])

  useEffect(() => {
    if (authReady && !isAuthenticated) setIsLoading(false)
  }, [authReady, isAuthenticated])

  const handleBackToProfile = useCallback(() => {
    router.push('/profile' as any)
  }, [router])

  const handleDayPress = useCallback((dateStr: string) => {
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr))
  }, [])

  // Избранные без явного статуса — они попадают в "Хочу" автоматически
  const favoritesAsWishlist = useMemo((): DisplayEntry[] => {
    const statusIds = new Set(entries.map((e) => String(e.id)))
    return (Array.isArray(favorites) ? favorites : [])
      .filter((f) => f.type === 'travel' && !statusIds.has(String(f.id)))
      .map((f) => ({
        id: f.id,
        type: 'travel' as const,
        title: f.title,
        imageUrl: f.imageUrl,
        url: f.url,
        country: f.country,
        city: f.city,
        status: 'wishlist' as TravelStatus,
        addedAt: f.addedAt,
        _isFavorite: true,
      }))
  }, [favorites, entries])

  // Данные для текущего таба
  const tabData = useMemo((): DisplayEntry[] => {
    if (activeTab === 'wishlist') {
      // Явно добавленные + избранные без статуса, без дублей
      const explicit = getByStatus('wishlist').map((e): DisplayEntry => ({ ...e, _isFavorite: false }))
      const merged = [...explicit, ...favoritesAsWishlist]
      return merged.sort((a, b) => b.addedAt - a.addedAt)
    }
    const all = getByStatus(activeTab).map((e): DisplayEntry => ({ ...e, _isFavorite: false }))
    if (activeTab === 'planned' && selectedDate) {
      return all.filter((e) => e.plannedDate === selectedDate)
    }
    if (activeTab === 'planned') {
      return [...all].sort((a, b) => {
        if (a.plannedDate && b.plannedDate) return a.plannedDate.localeCompare(b.plannedDate)
        return a.plannedDate ? -1 : 1
      })
    }
    return [...all].sort((a, b) => b.addedAt - a.addedAt)
  }, [activeTab, selectedDate, getByStatus, entries, favoritesAsWishlist]) // eslint-disable-line react-hooks/exhaustive-deps

  // Счётчики для табов
  const tabCounts = useMemo(() => ({
    visited: getByStatus('visited').length,
    planned: getByStatus('planned').length,
    wishlist: getByStatus('wishlist').length + favoritesAsWishlist.length,
  }), [getByStatus, entries, favoritesAsWishlist]) // eslint-disable-line react-hooks/exhaustive-deps

  // Поездки для MiniCalendar (только planned)
  const plannedEntries = useMemo(() => getByStatus('planned'), [getByStatus, entries]) // eslint-disable-line react-hooks/exhaustive-deps

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      gap: 8,
    },
    tabBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1.5,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
    },
    tabBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabBtnTextActive: {
      color: colors.surface,
    },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
      paddingTop: 4,
    },
    cardsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    cardWrap: {
      width: '100%',
      marginBottom: 12,
    },
    skeletonWrap: {
      padding: 16,
      gap: 16,
    },
    hint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 6,
      marginBottom: 2,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    hintText: {
      flex: 1,
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 16,
    },
    plannedDateLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
      marginTop: 4,
      paddingHorizontal: 12,
    },
  }), [colors])

  const seoBlock = (
    <InstantSEO
      headKey="calendar"
      title="Мой календарь | Metravel"
      description="Мои планы и путешествия"
      canonical={canonical}
      robots="noindex, nofollow"
    />
  )

  if (!authReady) {
    return (
      <SafeAreaView style={styles.container}>
        {seoBlock}
        <View style={styles.skeletonWrap}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonLoader key={i} width="100%" height={200} borderRadius={12} />
          ))}
        </View>
      </SafeAreaView>
    )
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        {seoBlock}
        <EmptyState
          icon="calendar"
          title="Войдите в аккаунт"
          description="Войдите, чтобы планировать путешествия и вести свой календарь."
          action={{
            label: 'Войти',
            onPress: () => router.push(buildLoginHref({ redirect: '/calendar', intent: 'calendar' }) as any),
          }}
        />
      </SafeAreaView>
    )
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {seoBlock}
        <ProfileCollectionHeader title="Мой календарь" onBackPress={handleBackToProfile} />
        <View style={styles.skeletonWrap}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonLoader key={i} width="100%" height={200} borderRadius={12} />
          ))}
        </View>
      </SafeAreaView>
    )
  }

  const emptyConfig = EMPTY_STATE[activeTab]

  return (
    <SafeAreaView style={styles.container}>
      {seoBlock}
      <ProfileCollectionHeader title="Мой календарь" onBackPress={handleBackToProfile} />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const count = tabCounts[tab.key]
          const isActive = activeTab === tab.key
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabBtn, isActive && styles.tabBtnActive, globalFocusStyles.focusable]}
              onPress={() => {
                setActiveTab(tab.key)
                setSelectedDate(null)
              }}
              accessibilityRole="button"
              accessibilityLabel={`${tab.label}${count ? `, ${count}` : ''}`}
              accessibilityState={{ selected: isActive }}
            >
              <Feather
                name={tab.icon}
                size={15}
                color={isActive ? colors.surface : colors.textMuted}
              />
              <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                {tab.label}
                {count > 0 ? ` (${count})` : ''}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <ScrollView
        style={webTouchScrollStyle}
        showsVerticalScrollIndicator={false}
      >
        {/* Hint — how to add items */}
        {activeTab === 'wishlist' && (
          <View style={styles.hint}>
            <Feather name="info" size={13} color={colors.textMuted} />
            <Text style={styles.hintText}>
              Избранные ❤️ автоматически попада��т сюда. Или открой путешествие → «Добавить в план» → «Хочу поехать».
            </Text>
          </View>
        )}
        {activeTab === 'planned' && (
          <View style={styles.hint}>
            <Feather name="info" size={13} color={colors.textMuted} />
            <Text style={styles.hintText}>
              Открой путешествие → на��ми «Добавить в план» → «Планирую» → выбери дату.
            </Text>
          </View>
        )}
        {activeTab === 'visited' && (
          <View style={styles.hint}>
            <Feather name="info" size={13} color={colors.textMuted} />
            <Text style={styles.hintText}>
              Открой путешествие → нажми «Добавить в план» → «Был здесь».
            </Text>
          </View>
        )}
        {/* Mini calendar — only for planned tab */}
        {activeTab === 'planned' && (
          <MiniCalendar
            entries={plannedEntries}
            onDayPress={handleDayPress}
            selectedDate={selectedDate}
          />
        )}

        {/* Active date filter chip */}
        {activeTab === 'planned' && selectedDate && (
          <View style={styles.filterRow}>
            <Pressable
              style={[styles.filterChip, globalFocusStyles.focusable]}
              onPress={() => setSelectedDate(null)}
              accessibilityRole="button"
              accessibilityLabel={`Сбросить фильтр: ${selectedDate}`}
            >
              <Feather name="calendar" size={13} color={colors.primary} />
              <Text style={styles.filterChipText}>{selectedDate}</Text>
              <Feather name="x" size={13} color={colors.primary} />
            </Pressable>
          </View>
        )}

        {/* Content */}
        {tabData.length === 0 ? (
          <EmptyState
            icon={emptyConfig.icon}
            title={emptyConfig.title}
            description={emptyConfig.description}
            variant="empty"
            action={{
              label: emptyConfig.actionLabel,
              onPress: () => router.push('/search'),
            }}
          />
        ) : (
          <View style={styles.listContent}>
            {tabData.map((item: DisplayEntry) => (
              <View key={`${item._isFavorite ? 'fav' : item.status}-${item.id}`} style={styles.cardWrap}>
                <TabTravelCard
                  item={{
                    id: item.id,
                    title: cleanTravelTitle(item.title, item.country),
                    imageUrl: item.imageUrl,
                    city: item.city ?? null,
                    country: item.country ?? null,
                  }}
                  badge={{
                    icon: item._isFavorite ? 'heart' : (TABS.find((t) => t.key === item.status)?.icon ?? 'bookmark'),
                    backgroundColor: item._isFavorite ? colors.danger : BADGE_COLORS[item.status],
                    iconColor: '#ffffff',
                  }}
                  onPress={() => router.push(item.url as any)}
                  layout="grid"
                />
                {item.status === 'planned' && item.plannedDate && (
                  <Text style={styles.plannedDateLabel}>
                    📅 {item.plannedDate}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

