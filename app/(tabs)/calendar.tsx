import { memo, useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react'
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
  type GestureResponderEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { useAuth } from '@/context/AuthContext'
import {
  getTravelStatusCalendarDate,
  parseTravelStatusDateParts,
  useTravelStatusStore,
  type TravelStatus,
  type TravelStatusEntry,
} from '@/stores/travelStatusStore'
import EmptyState from '@/components/ui/EmptyState'
import ProfileCollectionHeader from '@/components/profile/ProfileCollectionHeader'
import MiniCalendar from '@/components/calendar/MiniCalendar'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard'
import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { globalFocusStyles } from '@/styles/globalFocus'
import { buildLoginHref } from '@/utils/authNavigation'
import { webTouchScrollStyle } from '@/utils'
import { buildCanonicalUrl } from '@/utils/seo'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { cleanTravelTitle } from '@/utils/cleanTravelTitle'
import {
  getDateFieldForTravelStatus,
  getExplicitTravelStatusDate,
} from '@/utils/travelStatusCalendarDisplay'

type IconName = ComponentProps<typeof Feather>['name']

type CalendarTab = {
  key: TravelStatus
  label: string
  icon: IconName
}

type EmptyStateConfig = {
  icon: string
  title: string
  description: string
  actionLabel: string
}

type CalendarEntry = TravelStatusEntry

type DateEditorState = {
  item: CalendarEntry
  status: TravelStatus
  value: string
  error: string
} | null

type StatusBuckets = Record<TravelStatus, CalendarEntry[]>
type CalendarStyles = ReturnType<typeof createCalendarStyles>

const TABS: CalendarTab[] = [
  { key: 'visited', label: 'Был', icon: 'check-circle' },
  { key: 'planned', label: 'Планирую', icon: 'calendar' },
  { key: 'wishlist', label: 'Хочу', icon: 'bookmark' },
]

const EMPTY_STATE: Record<TravelStatus, EmptyStateConfig> = {
  visited: {
    icon: 'check-circle',
    title: 'Нет посещённых мест',
    description: 'Открой путешествие и отметь его статусом «Был здесь», чтобы оно появилось в этом разделе.',
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
    description: 'Открой путешествие и выбери статус «Хочу поехать», чтобы собрать здесь личный список желаний.',
    actionLabel: 'Найти маршруты',
  },
}

const TAB_HINTS: Record<TravelStatus, string> = {
  visited: 'Выбери дату, чтобы увидеть посещённые поездки за этот день. Если точной даты нет, добавь её прямо в карточке.',
  planned: 'Выбери дату, чтобы отфильтровать запланированные поездки.',
  wishlist: 'Это личный список желаний. Дата для него не обязательна — главное, что вы хотите сохранить маршрут на потом.',
}

const CARD_META_ICON_STYLE = { marginRight: 4 } as const
const DEFAULT_BUCKETS: StatusBuckets = {
  visited: [],
  planned: [],
  wishlist: [],
}

const getCalendarDate = (entry: CalendarEntry): string | undefined =>
  getExplicitTravelStatusDate(entry) ?? getTravelStatusCalendarDate(entry)

const getLocationLabel = (entry: CalendarEntry) =>
  [entry.city, entry.country].filter(Boolean).join(', ')

const getTravelPeriodLabel = (entry: CalendarEntry) => {
  const parts = [entry.travelMonthName, entry.travelYear].filter(Boolean)
  if (parts.length > 0) return parts.join(' ')
  return entry.travelYear
}

const getEntryKey = (entry: CalendarEntry) =>
  `${entry.status}-${String(entry.id)}`

const isSelectedCalendarDate = (entry: CalendarEntry, selectedDate: string | null) => {
  if (!selectedDate) return true

  const explicitDate = getExplicitTravelStatusDate(entry)
  if (explicitDate) return explicitDate === selectedDate

  const selectedParts = parseTravelStatusDateParts(selectedDate)
  const displayParts = parseTravelStatusDateParts(getCalendarDate(entry))
  if (!selectedParts || !displayParts) return false

  return selectedParts.year === displayParts.year && selectedParts.month === displayParts.month
}

const groupEntriesByStatus = (entries: TravelStatusEntry[]): StatusBuckets =>
  entries.reduce<StatusBuckets>(
    (buckets, entry) => {
      buckets[entry.status].push(entry)
      return buckets
    },
    { visited: [], planned: [], wishlist: [] }
  )

const sortCalendarEntries = (entries: CalendarEntry[], status: TravelStatus) =>
  [...entries].sort((a, b) => {
    const dateA = getCalendarDate(a)
    const dateB = getCalendarDate(b)

    if (dateA && dateB) {
      return status === 'planned' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA)
    }

    if (!dateA && !dateB) return b.addedAt - a.addedAt
    return dateA ? -1 : 1
  })

const getDateEditorSubtitle = (status?: TravelStatus) => {
  if (status === 'visited') return 'Укажи дату, когда ты был в этом путешествии.'
  if (status === 'wishlist') return 'Этот статус просто сохраняет маршрут в ваш личный список желаний. Дата не обязательна.'
  return 'Укажи дату запланированной поездки.'
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

const CalendarTabs = memo(function CalendarTabs({
  activeTab,
  counts,
  colors,
  badgeColors,
  styles,
  onChange,
}: {
  activeTab: TravelStatus
  counts: Record<TravelStatus, number>
  colors: ReturnType<typeof useThemedColors>
  badgeColors: Record<TravelStatus, string>
  styles: CalendarStyles
  onChange: (tab: TravelStatus) => void
}) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        const count = counts[tab.key]
        const isActive = activeTab === tab.key
        const activeStyle = isActive
          ? { backgroundColor: badgeColors[tab.key], borderColor: badgeColors[tab.key] }
          : null

        return (
          <Pressable
            key={tab.key}
            style={[
              styles.tabButton,
              isActive && styles.tabButtonActive,
              activeStyle,
              globalFocusStyles.focusable,
            ]}
            onPress={() => onChange(tab.key)}
            accessibilityRole="button"
            accessibilityLabel={`${tab.label}${count ? `, ${count}` : ''}`}
            accessibilityState={{ selected: isActive }}
          >
            <Feather name={tab.icon} size={15} color={isActive ? colors.surface : colors.textMuted} />
            <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
              {tab.label}
              {count > 0 ? ` (${count})` : ''}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
})

const SelectedDateFilter = memo(function SelectedDateFilter({
  selectedDate,
  accentColor,
  accentSoftColor,
  styles,
  onClear,
}: {
  selectedDate: string | null
  accentColor: string
  accentSoftColor: string
  styles: CalendarStyles
  onClear: () => void
}) {
  if (!selectedDate) return null

  return (
    <View style={styles.filterRow}>
      <Pressable
        style={[
          styles.filterChip,
          { backgroundColor: accentSoftColor, borderColor: accentColor },
          globalFocusStyles.focusable,
        ]}
        onPress={onClear}
        accessibilityRole="button"
        accessibilityLabel={`Сбросить фильтр: ${selectedDate}`}
      >
        <Feather name="calendar" size={13} color={accentColor} />
        <Text style={[styles.filterChipText, { color: accentColor }]}>{selectedDate}</Text>
        <Feather name="x" size={13} color={accentColor} />
      </Pressable>
    </View>
  )
})

const CalendarTravelCard = memo(function CalendarTravelCard({
  entry,
  colors,
  badgeColors,
  styles,
  onOpen,
  onEditDate,
}: {
  entry: CalendarEntry
  colors: ReturnType<typeof useThemedColors>
  badgeColors: Record<TravelStatus, string>
  styles: CalendarStyles
  onOpen: (url: string) => void
  onEditDate: (entry: CalendarEntry, event: GestureResponderEvent) => void
}) {
  const calendarDate = getCalendarDate(entry)
  const hasCalendarDate = Boolean(calendarDate)
  const accentColor = badgeColors[entry.status]
  const location = getLocationLabel(entry)
  const travelPeriod = getTravelPeriodLabel(entry)
  const explicitDate = getExplicitTravelStatusDate(entry)
  const isWishlist = entry.status === 'wishlist'
  const dateMetaLabel = explicitDate
    ? `Дата: ${explicitDate}`
    : isWishlist
      ? 'Личный статус без даты'
    : travelPeriod
      ? 'Точная дата не указана'
      : 'Дата не указана'

  return (
    <View style={styles.cardWrap}>
      <UnifiedTravelCard
        title={cleanTravelTitle(entry.title, entry.country)}
        imageUrl={entry.imageUrl ?? null}
        metaText={location || ' '}
        onPress={() => onOpen(entry.url)}
        mediaFit="contain"
        heroTitleOverlay
        imageHeight={Platform.OS === 'web' ? 168 : 150}
        style={[globalFocusStyles.focusable, Platform.OS === 'web' ? ({ height: '100%' } as any) : null]}
        testID={`calendar-travel-card-${String(entry.id)}`}
        contentSlot={
          <View style={styles.cardMetaStack}>
            <View style={styles.cardMetaContent}>
              <Feather name="map-pin" size={12} color={colors.textMuted} style={CARD_META_ICON_STYLE} />
              <Text style={styles.cardMetaText} numberOfLines={1}>
                {location || ' '}
              </Text>
            </View>
            {travelPeriod && (
              <View style={styles.cardMetaContent}>
                <Feather name="clock" size={12} color={colors.textMuted} style={CARD_META_ICON_STYLE} />
                <Text style={styles.cardMetaText} numberOfLines={1}>
                  Год/месяц: {travelPeriod}
                </Text>
              </View>
            )}
            <View style={styles.cardMetaContent}>
              <Feather name="calendar" size={12} color={colors.textMuted} style={CARD_META_ICON_STYLE} />
              <Text style={styles.cardMetaText} numberOfLines={1}>
                {dateMetaLabel}
              </Text>
            </View>
          </View>
        }
        mediaProps={{
          blurBackground: true,
          allowCriticalWebBlur: true,
          recyclingKey: String(entry.id),
        }}
      />

      <Pressable
        style={[
          styles.dateBadge,
          hasCalendarDate && { backgroundColor: accentColor, borderColor: accentColor },
          !hasCalendarDate && styles.emptyDateBadge,
          !hasCalendarDate && { borderColor: accentColor },
          globalFocusStyles.focusable,
        ]}
        onPress={(event) => onEditDate(entry, event)}
        accessibilityRole="button"
        accessibilityLabel={isWishlist ? 'Изменить статус' : hasCalendarDate ? `Изменить дату ${calendarDate}` : 'Добавить дату'}
        {...(Platform.OS === 'web' ? ({ 'data-card-action': 'true' } as any) : null)}
      >
        <Feather name={isWishlist ? 'bookmark' : hasCalendarDate ? 'calendar' : 'plus'} size={12} color={hasCalendarDate ? colors.surface : accentColor} />
        <Text
          style={[
            styles.dateBadgeText,
            !hasCalendarDate && styles.emptyDateBadgeText,
            !hasCalendarDate && { color: accentColor },
          ]}
        >
          {isWishlist ? 'Статус' : calendarDate ?? 'Дата'}
        </Text>
      </Pressable>
    </View>
  )
})

function DateEditorModal({
  editor,
  colors,
  badgeColors,
  styles,
  onChange,
  onStatusChange,
  onClose,
  onClear,
  onRemove,
  onSave,
}: {
  editor: DateEditorState
  colors: ReturnType<typeof useThemedColors>
  badgeColors: Record<TravelStatus, string>
  styles: CalendarStyles
  onChange: (value: string) => void
  onStatusChange: (status: TravelStatus) => void
  onClose: () => void
  onClear: () => void
  onRemove: () => void
  onSave: () => void
}) {
  const item = editor?.item
  const selectedStatus = editor?.status ?? item?.status
  const canClearDate = item ? Boolean(getExplicitTravelStatusDate(item)) : false
  const canRemoveStatus = Boolean(item)
  const subtitle = getDateEditorSubtitle(selectedStatus)
  const needsDateInput = selectedStatus !== 'wishlist'

  return (
    <Modal visible={Boolean(editor)} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Статус в календаре</Text>
          <Text style={styles.modalSubtitle}>{subtitle}</Text>

          <View style={styles.statusEditorRow}>
            {TABS.map((statusOption) => {
              const isActive = selectedStatus === statusOption.key
              const accentColor = badgeColors[statusOption.key]
              return (
                <Pressable
                  key={statusOption.key}
                  style={[
                    styles.statusEditorOption,
                    isActive && { backgroundColor: accentColor, borderColor: accentColor },
                    globalFocusStyles.focusable,
                  ]}
                  onPress={() => onStatusChange(statusOption.key)}
                  accessibilityRole="button"
                  accessibilityLabel={statusOption.label}
                  accessibilityState={{ selected: isActive }}
                >
                  <Feather name={statusOption.icon} size={14} color={isActive ? colors.surface : colors.textMuted} />
                  <Text style={[styles.statusEditorOptionText, isActive && { color: colors.surface }]}>
                    {statusOption.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {needsDateInput ? (
            Platform.OS === 'web' ? (
              <WebDateInput value={editor?.value ?? ''} onChange={onChange} />
            ) : (
              <TextInput
                style={styles.dateInput}
                value={editor?.value ?? ''}
                onChangeText={onChange}
                placeholder="ГГГГ-ММ-ДД"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                accessibilityLabel="Дата путешествия"
              />
            )
          ) : (
            <View style={styles.statusNoteBox}>
              <Feather name="bookmark" size={14} color={colors.textMuted} />
              <Text style={styles.statusNoteText}>Для статуса «Хочу» достаточно просто сохранить маршрут.</Text>
            </View>
          )}

          {!!editor?.error && <Text style={styles.dateError}>{editor.error}</Text>}

          <View style={styles.dateActions}>
            {canRemoveStatus && (
              <Pressable
                style={[styles.dateDangerButton, globalFocusStyles.focusable]}
                onPress={onRemove}
                accessibilityRole="button"
                accessibilityLabel="Удалить из календаря"
              >
                <Text style={styles.dateDangerText}>Удалить</Text>
              </Pressable>
            )}
            {canClearDate && (
              <Pressable
                style={[styles.dateSecondaryButton, globalFocusStyles.focusable]}
                onPress={onClear}
                accessibilityRole="button"
                accessibilityLabel="Убрать дату"
              >
                <Text style={styles.dateSecondaryText}>Убрать дату</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.dateSecondaryButton, globalFocusStyles.focusable]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Отмена"
            >
              <Text style={styles.dateSecondaryText}>Отмена</Text>
            </Pressable>
            <Pressable
              style={[styles.datePrimaryButton, globalFocusStyles.focusable]}
              onPress={onSave}
              accessibilityRole="button"
              accessibilityLabel={needsDateInput ? 'Сохранить дату' : 'Сохранить статус'}
            >
              <Text style={styles.datePrimaryText}>{needsDateInput ? 'Сохранить' : 'Сохранить статус'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function CalendarSkeleton({ styles, showHeader, seoBlock, onBackPress }: {
  styles: CalendarStyles
  showHeader?: boolean
  seoBlock: React.ReactNode
  onBackPress: () => void
}) {
  return (
    <SafeAreaView style={styles.container}>
      {seoBlock}
      {showHeader && <ProfileCollectionHeader title="Мой календарь" onBackPress={onBackPress} />}
      <View style={styles.skeletonWrap}>
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonLoader key={index} width="100%" height={200} borderRadius={12} />
        ))}
      </View>
    </SafeAreaView>
  )
}

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

function createCalendarStyles(colors: ReturnType<typeof useThemedColors>, isWideLayout: boolean) {
  return StyleSheet.create({
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
    introCard: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      padding: 16,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 8,
    },
    introBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    introBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    introTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    introDescription: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    tabButton: {
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
    tabButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabButtonTextActive: {
      color: colors.surface,
    },
    contentLayout: {
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
      ...(isWideLayout ? { width: 360, flexShrink: 0 } as any : null),
    },
    listPane: {
      flex: 1,
      minWidth: 0,
      ...(isWideLayout ? { paddingTop: 0 } as any : null),
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
    dateBadge: {
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
    emptyDateBadge: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
    },
    dateBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.surface,
    },
    emptyDateBadgeText: {
      color: colors.primary,
    },
    cardMetaStack: {
      gap: 3,
    },
    cardMetaContent: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 18,
    },
    cardMetaText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      flex: 1,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
      alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
      padding: Platform.OS === 'web' ? 16 : 0,
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: DESIGN_TOKENS.radii.xl,
      borderTopRightRadius: DESIGN_TOKENS.radii.xl,
      paddingTop: 8,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 36 : 24,
      ...(Platform.OS === 'web'
        ? {
            width: 'min(520px, calc(100vw - 32px))',
            borderBottomLeftRadius: DESIGN_TOKENS.radii.xl,
            borderBottomRightRadius: DESIGN_TOKENS.radii.xl,
            boxShadow: DESIGN_TOKENS.shadows.heavy,
          } as any
        : null),
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
    statusEditorRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 14,
    },
    statusEditorOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : null),
    },
    statusEditorOptionText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
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
    statusNoteBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    statusNoteText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
    },
    dateActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
      flexWrap: 'wrap',
    },
    dateSecondaryButton: {
      flexGrow: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: DESIGN_TOKENS.radii.pill,
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    datePrimaryButton: {
      flexGrow: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: DESIGN_TOKENS.radii.pill,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    dateDangerButton: {
      flexGrow: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: DESIGN_TOKENS.radii.pill,
      alignItems: 'center',
      backgroundColor: colors.dangerLight,
      borderWidth: 1,
      borderColor: colors.danger,
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
    dateDangerText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.danger,
    },
  })
}
