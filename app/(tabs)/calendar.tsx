import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  Modal,
  TextInput,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { useAuth } from '@/context/AuthContext'
import { useFavorites } from '@/context/FavoritesContext'
import { getTravelStatusCalendarDate, parseTravelStatusDateParts, useTravelStatusStore, type TravelStatus, type TravelStatusEntry } from '@/stores/travelStatusStore'
import { useMyTravels } from '@/hooks/useMyTravels'
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
    description: 'Открой любое путешествие, нажми «Добавить в план», затем «Планирую» и выбери дату.',
    actionLabel: 'Найти маршрут',
  },
  wishlist: {
    icon: 'bookmark',
    title: 'Список желаний пуст',
    description: 'Добавляй путешествия в избранное или открой путешествие и выбери «Хочу поехать».',
    actionLabel: 'Найти маршруты',
  },
}

const TAB_HINTS: Record<TravelStatus, string> = {
  visited: 'Выбери дату, чтобы увидеть посещённые поездки за этот день. Если точной даты нет, добавь её прямо в карточке.',
  planned: 'Выбери дату, чтобы отфильтровать запланированные поездки.',
  wishlist: 'Выбери дату, чтобы увидеть поездки из списка желаний на этот день. Избранные автоматически попадают сюда.',
}

const getDateFieldForStatus = (status: TravelStatus) => {
  if (status === 'visited') return 'visitedDate'
  if (status === 'wishlist') return 'wishlistDate'
  return 'plannedDate'
}

function WebDateInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  if (Platform.OS !== 'web') return null
  return (
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{
        width: '100%',
        padding: '10px 12px',
        fontSize: 15,
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text)',
        outline: 'none',
        boxSizing: 'border-box',
      } as any}
    />
  )
}

// Универсальный тип для карточек в списке
type DisplayEntry = TravelStatusEntry & { _isFavorite?: boolean; _isAuthored?: boolean }

export default function CalendarScreen() {
  const router = useRouter()
  const canonical = buildCanonicalUrl('/calendar')
  const { isAuthenticated, authReady, userId } = useAuth()
  const colors = useThemedColors()
  const { width } = useWindowDimensions()
  const isWideLayout = Platform.OS === 'web' && width >= 900
  const { favorites } = useFavorites()

  const { loadLocal, getByStatus, entries, setStatus } = useTravelStatusStore()

  const { myTravels, load: loadMyTravels } = useMyTravels({
    userId: userId ?? null,
    perPage: 9999,
  })

  const [activeTab, setActiveTab] = useState<TravelStatus>('planned')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dateEditingItem, setDateEditingItem] = useState<DisplayEntry | null>(null)
  const [dateInput, setDateInput] = useState('')
  const [dateError, setDateError] = useState('')

  // Загружаем локальное хранилище
  useEffect(() => {
    if (!authReady || !isAuthenticated) return
    loadLocal(userId).finally(() => setIsLoading(false))
  }, [authReady, isAuthenticated, userId, loadLocal])

  useEffect(() => {
    if (authReady && !isAuthenticated) setIsLoading(false)
  }, [authReady, isAuthenticated])

  useEffect(() => {
    if (authReady && isAuthenticated) {
      loadMyTravels()
    }
  }, [authReady, isAuthenticated, loadMyTravels])

  const handleBackToProfile = useCallback(() => {
    router.push('/profile' as any)
  }, [router])

  const handleDayPress = useCallback((dateStr: string) => {
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr))
  }, [])

  // Авторские путешествия пользователя → в таб "Был"
  const authoredAsVisited = useMemo((): DisplayEntry[] => {
    const statusIds = new Set(entries.map((e) => String(e.id)))
    return myTravels
      .filter((t) => !statusIds.has(String(t.id)))
      .map((t) => ({
        id: t.id,
        type: 'travel' as const,
        title: t.name,
        imageUrl: t.travel_image_thumb_url || t.travel_image_thumb_small_url || undefined,
        url: t.url || `/travels/${t.slug || t.id}`,
        country: t.countryName || undefined,
        city: t.cityName || undefined,
        status: 'visited' as TravelStatus,
        addedAt: t.created_at ? new Date(t.created_at).getTime() : 0,
        _isAuthored: true,
      }))
  }, [myTravels, entries])

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

  const activeTabEntries = useMemo((): DisplayEntry[] => {
    if (activeTab === 'wishlist') {
      // Явно добавленные + избранные без статуса, без дублей
      const explicit = getByStatus('wishlist').map((e): DisplayEntry => ({ ...e, _isFavorite: false }))
      const merged = [...explicit, ...favoritesAsWishlist]
      return merged
    }
    if (activeTab === 'visited') {
      // Явно отмеченные как "Был" + авторские путешествия пользователя
      const explicit = getByStatus('visited').map((e): DisplayEntry => ({ ...e, _isFavorite: false }))
      const merged = [...explicit, ...authoredAsVisited]
      return merged
    }
    return getByStatus(activeTab).map((e): DisplayEntry => ({ ...e, _isFavorite: false }))
  }, [activeTab, getByStatus, entries, favoritesAsWishlist, authoredAsVisited]) // eslint-disable-line react-hooks/exhaustive-deps

  // Данные для текущего таба
  const tabData = useMemo((): DisplayEntry[] => {
    const all = selectedDate
      ? activeTabEntries.filter((e) => getTravelStatusCalendarDate(e) === selectedDate)
      : activeTabEntries
    return [...all].sort((a, b) => {
      const dateA = getTravelStatusCalendarDate(a)
      const dateB = getTravelStatusCalendarDate(b)
      if (dateA && dateB) {
        return activeTab === 'planned' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA)
      }
      if (!dateA && !dateB) return b.addedAt - a.addedAt
      return dateA ? -1 : 1
    })
  }, [activeTab, activeTabEntries, selectedDate])

  const calendarEntries = useMemo(() => activeTabEntries, [activeTabEntries])

  const handleOpenDateEditor = useCallback((item: DisplayEntry, e?: any) => {
    if (Platform.OS === 'web') {
      e?.preventDefault?.()
      e?.stopPropagation?.()
      e?.nativeEvent?.stopPropagation?.()
    }
    setDateEditingItem(item)
    setDateInput(getTravelStatusCalendarDate(item) ?? '')
    setDateError('')
  }, [])

  const handleCloseDateEditor = useCallback(() => {
    setDateEditingItem(null)
    setDateInput('')
    setDateError('')
  }, [])

  const saveItemDate = useCallback(async (item: DisplayEntry, value: string | null) => {
    const dateField = getDateFieldForStatus(item.status)
    await setStatus(
      {
        id: item.id,
        type: 'travel',
        title: item.title,
        url: item.url,
        imageUrl: item.imageUrl,
        country: item.country,
        city: item.city,
        status: item.status,
        ...(value ? { [dateField]: value } : {}),
      },
      userId
    )
  }, [setStatus, userId])

  const handleSaveDate = useCallback(async () => {
    if (!dateEditingItem) return
    if (!dateInput) {
      setDateError('Укажите дату')
      return
    }
    if (!parseTravelStatusDateParts(dateInput)) {
      setDateError('Введите дату в формате ГГГГ-ММ-ДД')
      return
    }
    await saveItemDate(dateEditingItem, dateInput)
    handleCloseDateEditor()
  }, [dateEditingItem, dateInput, handleCloseDateEditor, saveItemDate])

  const handleClearDate = useCallback(async () => {
    if (!dateEditingItem) return
    await saveItemDate(dateEditingItem, null)
    handleCloseDateEditor()
  }, [dateEditingItem, handleCloseDateEditor, saveItemDate])

  // Счётчики для табов
  const tabCounts = useMemo(() => ({
    visited: getByStatus('visited').length + authoredAsVisited.length,
    planned: getByStatus('planned').length,
    wishlist: getByStatus('wishlist').length + favoritesAsWishlist.length,
  }), [getByStatus, entries, favoritesAsWishlist, authoredAsVisited]) // eslint-disable-line react-hooks/exhaustive-deps

  const badgeColors = useMemo<Record<TravelStatus, string>>(() => ({
    visited: colors.success,
    planned: colors.primary,
    wishlist: colors.warning,
  }), [colors])

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
      flexWrap: 'wrap',
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
    plannedLayout: {
      ...(isWideLayout
        ? {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 16,
            paddingHorizontal: 16,
            paddingTop: 4,
          } as any
        : null),
    },
    calendarPane: {
      ...(isWideLayout
        ? {
            width: 360,
            flexShrink: 0,
          } as any
        : null),
    },
    plannedListPane: {
      flex: 1,
      minWidth: 0,
      ...(isWideLayout ? { paddingTop: 0 } as any : null),
    },
    cardsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    cardWrap: {
      width: isWideLayout ? 'calc(33.333% - 8px)' as any : '100%',
      minWidth: isWideLayout ? 260 : undefined,
      marginBottom: 12,
      position: 'relative',
      ...(Platform.OS === 'web' ? { flexGrow: 0 } as any : null),
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
      position: 'absolute',
      top: 10,
      right: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primary,
      zIndex: 3,
      ...(Platform.OS === 'web'
        ? {
            boxShadow: DESIGN_TOKENS.shadows.light,
            cursor: 'pointer',
          } as any
        : null),
    },
    plannedDateLabelEmpty: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
    },
    plannedDateText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.surface,
    },
    plannedDateTextEmpty: {
      color: colors.primary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: DESIGN_TOKENS.radii.xl,
      borderTopRightRadius: DESIGN_TOKENS.radii.xl,
      paddingTop: 8,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderLight,
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    modalSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
      marginBottom: 14,
    },
    dateInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background,
    },
    dateError: {
      fontSize: 12,
      color: colors.danger,
      marginTop: 6,
    },
    dateActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
      flexWrap: 'wrap',
    },
    dateSecondaryBtn: {
      flexGrow: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: DESIGN_TOKENS.radii.pill,
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    datePrimaryBtn: {
      flexGrow: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: DESIGN_TOKENS.radii.pill,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    dateSecondaryText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    datePrimaryText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.surface,
    },
  }), [colors, isWideLayout])

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
        <View style={styles.plannedLayout}>
          <View style={styles.calendarPane}>
            <View style={styles.hint}>
              <Feather name="info" size={13} color={colors.textMuted} />
              <Text style={styles.hintText}>{TAB_HINTS[activeTab]}</Text>
            </View>
            <MiniCalendar
              entries={calendarEntries}
              onDayPress={handleDayPress}
              selectedDate={selectedDate}
            />
            {selectedDate && (
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
          </View>

          <View style={[styles.listContent, styles.plannedListPane]}>
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
              <View style={styles.cardsGrid}>
                {tabData.map((item: DisplayEntry) => {
                  const calendarDate = getTravelStatusCalendarDate(item)
                  const hasCalendarDate = Boolean(calendarDate)
                  return (
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
                          icon: item._isFavorite ? 'heart' : item._isAuthored ? 'edit-2' : (TABS.find((t) => t.key === item.status)?.icon ?? 'bookmark'),
                          backgroundColor: item._isFavorite ? colors.danger : badgeColors[item.status],
                          iconColor: colors.surface,
                        }}
                        onPress={() => router.push(item.url as any)}
                        layout="grid"
                        mediaFit="cover"
                      />
                      <Pressable
                        style={[
                          styles.plannedDateLabel,
                          !hasCalendarDate && styles.plannedDateLabelEmpty,
                          globalFocusStyles.focusable,
                        ]}
                        onPress={(event) => handleOpenDateEditor(item, event)}
                        accessibilityRole="button"
                        accessibilityLabel={hasCalendarDate ? `Изменить дату ${calendarDate}` : 'Добавить дату'}
                      >
                        <Feather
                          name={hasCalendarDate ? 'calendar' : 'plus'}
                          size={12}
                          color={hasCalendarDate ? colors.surface : colors.primary}
                        />
                        <Text style={[styles.plannedDateText, !hasCalendarDate && styles.plannedDateTextEmpty]}>
                          {calendarDate ?? 'Дата'}
                        </Text>
                      </Pressable>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(dateEditingItem)}
        transparent
        animationType="slide"
        onRequestClose={handleCloseDateEditor}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseDateEditor}>
          <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Дата путешествия</Text>
            <Text style={styles.modalSubtitle}>
              {dateEditingItem?.status === 'visited'
                ? 'Укажи дату, когда ты был в этом путешествии.'
                : dateEditingItem?.status === 'wishlist'
                  ? 'Укажи ориентировочную дату для списка желаний.'
                  : 'Укажи дату запланированной поездки.'}
            </Text>
            {Platform.OS === 'web' ? (
              <WebDateInput value={dateInput} onChange={(value) => { setDateInput(value); setDateError('') }} />
            ) : (
              <TextInput
                style={styles.dateInput}
                value={dateInput}
                onChangeText={(value) => { setDateInput(value); setDateError('') }}
                placeholder="ГГГГ-ММ-ДД"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                accessibilityLabel="Дата путешествия"
              />
            )}
            {!!dateError && <Text style={styles.dateError}>{dateError}</Text>}
            <View style={styles.dateActions}>
              {dateEditingItem && getTravelStatusCalendarDate(dateEditingItem) && (
                <Pressable
                  style={[styles.dateSecondaryBtn, globalFocusStyles.focusable]}
                  onPress={handleClearDate}
                  accessibilityRole="button"
                  accessibilityLabel="Убрать дату"
                >
                  <Text style={styles.dateSecondaryText}>Убрать дату</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.dateSecondaryBtn, globalFocusStyles.focusable]}
                onPress={handleCloseDateEditor}
                accessibilityRole="button"
                accessibilityLabel="Отмена"
              >
                <Text style={styles.dateSecondaryText}>Отмена</Text>
              </Pressable>
              <Pressable
                style={[styles.datePrimaryBtn, globalFocusStyles.focusable]}
                onPress={handleSaveDate}
                accessibilityRole="button"
                accessibilityLabel="Сохранить дату"
              >
                <Text style={styles.datePrimaryText}>Сохранить</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}
