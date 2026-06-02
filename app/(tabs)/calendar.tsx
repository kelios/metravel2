import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Platform,
  ScrollView,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { useAuth } from '@/context/AuthContext'
import {
  parseTravelStatusDateParts,
  useTravelStatusStore,
  type TravelStatus,
} from '@/stores/travelStatusStore'
import EmptyState from '@/components/ui/EmptyState'
import ProfileCollectionHeader from '@/components/profile/ProfileCollectionHeader'
import MiniCalendar from '@/components/calendar/MiniCalendar'
import { useThemedColors } from '@/hooks/useTheme'
import { buildLoginHref } from '@/utils/authNavigation'
import { webTouchScrollStyle } from '@/utils'
import { buildCanonicalUrl } from '@/utils/seo'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { getDateFieldForTravelStatus } from '@/utils/travelStatusCalendarDisplay'

import { createCalendarStyles } from './calendarScreen.styles'
import {
  type CalendarEntry,
  type DateEditorState,
  DEFAULT_BUCKETS,
  EMPTY_STATE,
  TAB_HINTS,
  getCalendarDate,
  getEntryKey,
  groupEntriesByStatus,
  isSelectedCalendarDate,
  sortCalendarEntries,
} from './calendarScreen.helpers'
import {
  CalendarSkeleton,
  CalendarTabs,
  CalendarTravelCard,
  DateEditorModal,
  SelectedDateFilter,
} from './calendarScreen.parts'

export default function CalendarScreen() {
  const router = useRouter()
  const colors = useThemedColors()
  const { width } = useWindowDimensions()
  const { isAuthenticated, authReady, userId } = useAuth()
  const entries = useTravelStatusStore((state) => state.entries)
  const loadLocal = useTravelStatusStore((state) => state.loadLocal)
  const setStatus = useTravelStatusStore((state) => state.setStatus)
  const removeStatus = useTravelStatusStore((state) => state.removeStatus)

  const [activeTab, setActiveTab] = useState<TravelStatus>('planned')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [hasLoadedLocalStatus, setHasLoadedLocalStatus] = useState(false)
  const [dateEditor, setDateEditor] = useState<DateEditorState>(null)

  const isWideLayout = Platform.OS === 'web' && width >= 900
  const styles = useMemo(() => createCalendarStyles(colors, isWideLayout), [colors, isWideLayout])
  const canonical = useMemo(() => buildCanonicalUrl('/calendar'), [])
  const seoBlock = useMemo(() => (
    <InstantSEO
      headKey="calendar"
      title="Мой календарь | Metravel"
      description="Мои планы и путешествия"
      canonical={canonical}
      robots="noindex, nofollow"
    />
  ), [canonical])

  useEffect(() => {
    if (!authReady) return
    if (!isAuthenticated) {
      setHasLoadedLocalStatus(true)
      return
    }

    let isMounted = true
    setHasLoadedLocalStatus(false)
    loadLocal(userId).finally(() => {
      if (isMounted) setHasLoadedLocalStatus(true)
    })

    return () => {
      isMounted = false
    }
  }, [authReady, isAuthenticated, loadLocal, userId])

  const statusEntries = useMemo(() => groupEntriesByStatus(entries), [entries])

  const activeEntries = statusEntries[activeTab] ?? DEFAULT_BUCKETS[activeTab]
  const visibleEntries = useMemo(
    () => sortCalendarEntries(
      activeEntries.filter((entry) => isSelectedCalendarDate(entry, selectedDate)),
      activeTab
    ),
    [activeEntries, activeTab, selectedDate]
  )
  const calendarFocusDate = useMemo(
    () => sortCalendarEntries(activeEntries, activeTab)
      .map(getCalendarDate)
      .find((date): date is string => Boolean(date)) ?? null,
    [activeEntries, activeTab]
  )
  const calendarEntries = useMemo(() => activeEntries.map((entry) => {
    const calendarDate = getCalendarDate(entry)
    if (!calendarDate) return entry

    const dateField = getDateFieldForTravelStatus(entry.status)
    return entry[dateField] ? entry : { ...entry, [dateField]: calendarDate }
  }), [activeEntries])

  const tabCounts = useMemo<Record<TravelStatus, number>>(() => ({
    visited: statusEntries.visited.length,
    planned: statusEntries.planned.length,
    wishlist: statusEntries.wishlist.length,
  }), [statusEntries])

  const badgeColors = useMemo<Record<TravelStatus, string>>(() => ({
    visited: colors.success,
    planned: colors.warning,
    wishlist: colors.warning,
  }), [colors.success, colors.warning])

  const activeAccentColor = badgeColors[activeTab]
  const activeAccentSoftColor = activeTab === 'planned' ? colors.warningLight : colors.primaryLight

  const handleBackToProfile = useCallback(() => {
    router.push('/profile' as any)
  }, [router])

  const handleChangeTab = useCallback((tab: TravelStatus) => {
    setActiveTab(tab)
    setSelectedDate(null)
  }, [])

  const handleDayPress = useCallback((date: string) => {
    setSelectedDate((currentDate) => (currentDate === date ? null : date))
  }, [])

  const handleClearSelectedDate = useCallback(() => {
    setSelectedDate(null)
  }, [])

  const handleOpenTravel = useCallback((url: string) => {
    router.push(url as any)
  }, [router])

  const handleOpenDateEditor = useCallback((item: CalendarEntry, event?: GestureResponderEvent) => {
    if (Platform.OS === 'web') {
      event?.preventDefault?.()
      event?.stopPropagation?.()
      const nativeEvent = event?.nativeEvent as { stopPropagation?: () => void } | undefined
      nativeEvent?.stopPropagation?.()
    }

    setDateEditor({
      item,
      status: item.status,
      value: getCalendarDate(item) ?? '',
      error: '',
    })
  }, [])

  const handleCloseDateEditor = useCallback(() => {
    setDateEditor(null)
  }, [])

  const handleDateInputChange = useCallback((value: string) => {
    setDateEditor((current) => current ? { ...current, value, error: '' } : current)
  }, [])

  const handleStatusInputChange = useCallback((status: TravelStatus) => {
    setDateEditor((current) => current ? { ...current, status, error: '' } : current)
  }, [])

  const saveItemStatus = useCallback(async (item: CalendarEntry, status: TravelStatus, value: string | null) => {
    const dateField = getDateFieldForTravelStatus(status)

    await setStatus(
      {
        id: item.id,
        type: 'travel',
        title: item.title,
        url: item.url,
        imageUrl: item.imageUrl,
        country: item.country,
        city: item.city,
        travelYear: item.travelYear,
        travelMonth: item.travelMonth,
        travelMonthName: item.travelMonthName,
        status,
        ...(value ? { [dateField]: value } : {}),
      },
      userId
    )
  }, [setStatus, userId])

  const handleSaveDate = useCallback(async () => {
    if (!dateEditor) return

    if (dateEditor.status === 'planned' && !dateEditor.value) {
      setDateEditor({ ...dateEditor, error: 'Укажите дату' })
      return
    }

    if (dateEditor.status === 'wishlist') {
      await saveItemStatus(dateEditor.item, dateEditor.status, null)
      handleCloseDateEditor()
      return
    }

    if (dateEditor.value && !parseTravelStatusDateParts(dateEditor.value)) {
      setDateEditor({ ...dateEditor, error: 'Введите дату в формате ГГГГ-ММ-ДД' })
      return
    }

    await saveItemStatus(dateEditor.item, dateEditor.status, dateEditor.value || null)
    handleCloseDateEditor()
  }, [dateEditor, handleCloseDateEditor, saveItemStatus])

  const handleClearDate = useCallback(async () => {
    if (!dateEditor) return
    await saveItemStatus(dateEditor.item, dateEditor.status, null)
    handleCloseDateEditor()
  }, [dateEditor, handleCloseDateEditor, saveItemStatus])

  const handleRemoveFromCalendar = useCallback(async () => {
    if (!dateEditor) return
    await removeStatus(dateEditor.item.id, userId)
    handleCloseDateEditor()
  }, [dateEditor, handleCloseDateEditor, removeStatus, userId])

  const handleLogin = useCallback(() => {
    router.push(buildLoginHref({ redirect: '/calendar', intent: 'calendar' }) as any)
  }, [router])

  const handleSearch = useCallback(() => {
    router.push('/search')
  }, [router])

  if (!authReady) {
    return <CalendarSkeleton styles={styles} seoBlock={seoBlock} onBackPress={handleBackToProfile} />
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        {seoBlock}
        <EmptyState
          icon="calendar"
          title="Войдите в аккаунт"
          description="Войдите, чтобы планировать путешествия и вести свой календарь."
          action={{ label: 'Войти', onPress: handleLogin }}
        />
      </SafeAreaView>
    )
  }

  if (!hasLoadedLocalStatus) {
    return <CalendarSkeleton styles={styles} showHeader seoBlock={seoBlock} onBackPress={handleBackToProfile} />
  }

  const emptyConfig = EMPTY_STATE[activeTab]

  return (
    <SafeAreaView style={styles.container}>
      {seoBlock}
      <ProfileCollectionHeader title="Мой календарь" onBackPress={handleBackToProfile} />

      <View style={styles.introCard}>
        <View style={styles.introBadge}>
          <Text style={styles.introBadgeText}>Только мои статусы</Text>
        </View>
        <Text style={styles.introTitle}>Где я был, что хочу и что планирую</Text>
        <Text style={styles.introDescription}>
          Этот экран не показывает общую статистику по маршрутам автора. Здесь только ваши личные отметки по поездкам.
        </Text>
      </View>

      <CalendarTabs
        activeTab={activeTab}
        counts={tabCounts}
        colors={colors}
        badgeColors={badgeColors}
        styles={styles}
        onChange={handleChangeTab}
      />

      <ScrollView style={webTouchScrollStyle} showsVerticalScrollIndicator={false}>
        <View style={styles.contentLayout}>
          <View style={styles.calendarPane}>
            <View style={styles.hint}>
              <Feather name="info" size={13} color={colors.textMuted} />
              <Text style={styles.hintText}>{TAB_HINTS[activeTab]}</Text>
            </View>
            <MiniCalendar
              entries={calendarEntries}
              onDayPress={handleDayPress}
              selectedDate={selectedDate}
              focusDate={calendarFocusDate}
              accentColor={activeAccentColor}
              accentSoftColor={activeAccentSoftColor}
            />
            <SelectedDateFilter
              selectedDate={selectedDate}
              accentColor={activeAccentColor}
              accentSoftColor={activeAccentSoftColor}
              styles={styles}
              onClear={handleClearSelectedDate}
            />
          </View>

          <View style={[styles.listContent, styles.listPane]}>
            {visibleEntries.length === 0 ? (
              <EmptyState
                icon={emptyConfig.icon}
                title={emptyConfig.title}
                description={emptyConfig.description}
                variant="empty"
                action={{ label: emptyConfig.actionLabel, onPress: handleSearch }}
              />
            ) : (
              <View style={styles.cardsGrid}>
                {visibleEntries.map((entry) => (
                  <CalendarTravelCard
                    key={getEntryKey(entry)}
                    entry={entry}
                    colors={colors}
                    badgeColors={badgeColors}
                    styles={styles}
                    onOpen={handleOpenTravel}
                    onEditDate={handleOpenDateEditor}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <DateEditorModal
        editor={dateEditor}
        colors={colors}
        badgeColors={badgeColors}
        styles={styles}
        onChange={handleDateInputChange}
        onStatusChange={handleStatusInputChange}
        onClose={handleCloseDateEditor}
        onClear={handleClearDate}
        onRemove={handleRemoveFromCalendar}
        onSave={handleSaveDate}
      />
    </SafeAreaView>
  )
}
