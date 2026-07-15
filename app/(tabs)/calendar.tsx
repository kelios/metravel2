import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Alert,
  Platform,
  ScrollView,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { useAuth } from '@/context/AuthContext'
import {
  parseTravelStatusDateParts,
  useTravelStatusStore,
  type TravelStatus,
} from '@/stores/travelStatusStore'
import EmptyState from '@/components/ui/EmptyState'
import ProfileCollectionHeader, {
  type ProfileCollectionBreadcrumb,
} from '@/components/profile/ProfileCollectionHeader'
import MiniCalendar from '@/components/calendar/MiniCalendar'
import { useThemedColors } from '@/hooks/useTheme'
import { buildLoginHref } from '@/utils/authNavigation'
import { webTouchScrollStyle } from '@/utils'
import { buildCanonicalUrl } from '@/utils/seo'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { getDateFieldForTravelStatus } from '@/utils/travelStatusCalendarDisplay'
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler'

import { createCalendarStyles } from '@/components/screens/calendar/calendarScreen.styles'
import {
  type CalendarEntry,
  type DateEditorState,
  DEFAULT_BUCKETS,
  EMPTY_STATE,
  TAB_HINTS,
  buildCalendarEntriesWithDates,
  getCalendarDate,
  getEntryKey,
  groupEntriesByStatus,
  isSelectedCalendarDate,
  sortCalendarEntries,
} from '@/components/screens/calendar/calendarScreen.helpers'
import {
  CalendarSkeleton,
  CalendarTabs,
  CalendarTravelCard,
  DateEditorModal,
  SelectedDateFilter,
} from '@/components/screens/calendar/calendarScreen.parts'
import { translate as i18nT } from '@/i18n'


function confirmRemoveFromCalendar(title: string, onConfirm: () => void) {
  const cleanTitle = title?.trim() || i18nT('calendarStatic:removeFallbackTravel')
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && !window.confirm(i18nT('calendar:app.tabs.calendar.ubrat_value1_iz_kalendarya_4710e4cf', { value1: cleanTitle }))) return
    onConfirm()
    return
  }
  Alert.alert(
    i18nT('calendar:app.tabs.calendar.ubrat_iz_kalendarya_171623ca'),
    i18nT('calendar:app.tabs.calendar.value1_ischeznet_iz_kalendarya_sam_marshrut__79185a97', { value1: cleanTitle }),
    [
      { text: i18nT('calendar:app.tabs.calendar.otmena_57439d65'), style: 'cancel' },
      { text: i18nT('calendar:app.tabs.calendar.ubrat_77b9552b'), style: 'destructive', onPress: onConfirm },
    ]
  )
}

function parseStatusParam(value: unknown): TravelStatus | null {
  if (value === 'visited' || value === 'planned' || value === 'wishlist') return value
  return null
}

const CALENDAR_BREADCRUMBS: ProfileCollectionBreadcrumb[] = [
  { get label() { return i18nT('calendarStatic:app.tabs.calendar.glavnaya_1fc899e5') }, path: '/', icon: 'home' },
  { get label() { return i18nT('calendarStatic:app.tabs.calendar.profil_b32c82d5') }, path: '/profile' },
  { get label() { return i18nT('calendarStatic:app.tabs.calendar.moy_kalendar_f9da1dd3') }, path: '/calendar' },
]

export default function CalendarScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ status?: string }>()
  const colors = useThemedColors()
  const { width } = useWindowDimensions()
  const { isAuthenticated, authReady, userId } = useAuth()
  const entries = useTravelStatusStore((state) => state.entries)
  const loadLocal = useTravelStatusStore((state) => state.loadLocal)
  const setStatus = useTravelStatusStore((state) => state.setStatus)
  const removeStatus = useTravelStatusStore((state) => state.removeStatus)

  const [activeTab, setActiveTab] = useState<TravelStatus>(() => parseStatusParam(params.status) ?? 'planned')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [hasLoadedLocalStatus, setHasLoadedLocalStatus] = useState(false)
  const [dateEditor, setDateEditor] = useState<DateEditorState>(null)

  const isWideLayout = Platform.OS === 'web' && width >= 900
  const styles = useMemo(() => createCalendarStyles(colors, isWideLayout), [colors, isWideLayout])
  const canonical = useMemo(() => buildCanonicalUrl('/calendar'), [])
  const seoBlock = useMemo(() => (
    <InstantSEO
      headKey="calendar"
      title={i18nT('calendar:app.tabs.calendar.moy_kalendar_metravel_1d39e960')}
      description={i18nT('calendar:app.tabs.calendar.moi_plany_i_puteshestviya_a3cff280')}
      canonical={canonical}
      robots="noindex, nofollow"
    />
  ), [canonical])

  useEffect(() => {
    const nextStatus = parseStatusParam(params.status)
    if (!nextStatus) return
    setActiveTab((current) => (current === nextStatus ? current : nextStatus))
    setSelectedDate(null)
  }, [params.status])

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
  const calendarEntries = useMemo(() => buildCalendarEntriesWithDates(activeEntries), [activeEntries])

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
    router.back()
  }, [router])

  const handleBreadcrumbPress = useCallback((path: string) => {
    router.push(path as any)
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
      setDateEditor({ ...dateEditor, error: i18nT('calendar:app.tabs.calendar.ukazhite_datu_69ef3cd1') })
      return
    }

    if (dateEditor.status === 'wishlist') {
      await saveItemStatus(dateEditor.item, dateEditor.status, null)
      handleCloseDateEditor()
      return
    }

    if (dateEditor.value && !parseTravelStatusDateParts(dateEditor.value)) {
      setDateEditor({ ...dateEditor, error: i18nT('calendar:app.tabs.calendar.vvedite_datu_v_formate_gggg_mm_dd_6183452e') })
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

  const handleRemoveFromCalendar = useCallback(() => {
    if (!dateEditor) return
    const item = dateEditor.item
    confirmRemoveFromCalendar(item.title, () => {
      void removeStatus(item.id, userId)
      handleCloseDateEditor()
    })
  }, [dateEditor, handleCloseDateEditor, removeStatus, userId])

  const handleRemoveEntry = useCallback((item: CalendarEntry, event?: GestureResponderEvent) => {
    if (Platform.OS === 'web') {
      event?.preventDefault?.()
      event?.stopPropagation?.()
      const nativeEvent = event?.nativeEvent as { stopPropagation?: () => void } | undefined
      nativeEvent?.stopPropagation?.()
    }
    confirmRemoveFromCalendar(item.title, () => {
      void removeStatus(item.id, userId)
    })
  }, [removeStatus, userId])

  // Android: при открытом редакторе даты Back сначала закрывает его; иначе
  // возвращает на предыдущий экран (Профиль), а не сбрасывает Tab-навигатор.
  useAndroidBackHandler(
    useCallback(() => {
      if (dateEditor) {
        handleCloseDateEditor()
        return true
      }
      return false
    }, [dateEditor, handleCloseDateEditor])
  )

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
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        {seoBlock}
        <EmptyState
          icon="calendar"
          title={i18nT('calendar:app.tabs.calendar.voydite_v_akkaunt_0eab41f5')}
          description={i18nT('calendar:app.tabs.calendar.voydite_chtoby_planirovat_puteshestviya_i_ve_f13cf76a')}
          action={{ label: i18nT('calendar:app.tabs.calendar.voyti_804d3851'), onPress: handleLogin }}
        />
      </SafeAreaView>
    )
  }

  if (!hasLoadedLocalStatus) {
    return (
      <CalendarSkeleton
        styles={styles}
        showHeader
        seoBlock={seoBlock}
        onBackPress={handleBackToProfile}
        breadcrumbs={CALENDAR_BREADCRUMBS}
        onBreadcrumbPress={handleBreadcrumbPress}
      />
    )
  }

  const emptyConfig = EMPTY_STATE[activeTab]
  // Список пуст из-за фильтра по дню (записи в разделе есть, но не на эту дату) —
  // показываем контекстную подсказку + сброс фильтра, а не «данных нет вовсе».
  const isDateFilteredEmpty = selectedDate != null && activeEntries.length > 0

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {seoBlock}
      <ProfileCollectionHeader
        title={i18nT('calendar:app.tabs.calendar.moy_kalendar_f9da1dd3')}
        onBackPress={handleBackToProfile}
        breadcrumbs={CALENDAR_BREADCRUMBS}
        onBreadcrumbPress={handleBreadcrumbPress}
        dense
      />

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
              isDateFilteredEmpty ? (
                <EmptyState
                  icon="calendar"
                  title={i18nT('calendar:app.tabs.calendar.v_etot_den_poezdok_net_b39357eb')}
                  description={i18nT('calendar:app.tabs.calendar.za_value1_zapisey_net_vsego_v_razdele_value2_1a757718', { value1: selectedDate, value2: activeEntries.length })}
                  variant="empty"
                  action={{ label: i18nT('calendar:app.tabs.calendar.pokazat_vse_302c971f'), onPress: handleClearSelectedDate }}
                />
              ) : (
                <EmptyState
                  icon={emptyConfig.icon}
                  title={emptyConfig.title}
                  description={emptyConfig.description}
                  variant="empty"
                  action={{ label: emptyConfig.actionLabel, onPress: handleSearch }}
                />
              )
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
                    onRemove={handleRemoveEntry}
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
