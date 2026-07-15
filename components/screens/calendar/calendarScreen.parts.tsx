import { memo } from 'react'
import {
  View,
  Text,
  Pressable,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  type GestureResponderEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Feather from '@expo/vector-icons/Feather'

import { type TravelStatus } from '@/stores/travelStatusStore'
import ProfileCollectionHeader, {
  type ProfileCollectionBreadcrumb,
} from '@/components/profile/ProfileCollectionHeader'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard'
import { useThemedColors } from '@/hooks/useTheme'
import { globalFocusStyles } from '@/styles/globalFocus'
import { cleanTravelTitle } from '@/utils/cleanTravelTitle'
import { getExplicitTravelStatusDate } from '@/utils/travelStatusCalendarDisplay'

import type { CalendarStyles } from './calendarScreen.styles'
import {
  type CalendarEntry,
  type DateEditorState,
  CARD_META_ICON_STYLE,
  TABS,
  getCalendarDate,
  getDateEditorSubtitle,
  getLocationLabel,
  getModerationBadge,
  getTravelPeriodLabel,
} from './calendarScreen.helpers'
import { translate as i18nT } from '@/i18n'


export function WebDateInput({
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

export const CalendarTabs = memo(function CalendarTabs({
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

export const SelectedDateFilter = memo(function SelectedDateFilter({
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
        accessibilityLabel={i18nT('calendar:components.screens.calendar.calendarScreen_parts.sbrosit_filtr_value1_1fdbc217', { value1: selectedDate })}
      >
        <Feather name="calendar" size={13} color={accentColor} />
        <Text style={[styles.filterChipText, { color: accentColor }]}>{selectedDate}</Text>
        <Feather name="x" size={13} color={accentColor} />
      </Pressable>
    </View>
  )
})

export const CalendarTravelCard = memo(function CalendarTravelCard({
  entry,
  colors,
  badgeColors,
  styles,
  onOpen,
  onEditDate,
  onRemove,
}: {
  entry: CalendarEntry
  colors: ReturnType<typeof useThemedColors>
  badgeColors: Record<TravelStatus, string>
  styles: CalendarStyles
  onOpen: (url: string) => void
  onEditDate: (entry: CalendarEntry, event: GestureResponderEvent) => void
  onRemove: (entry: CalendarEntry, event: GestureResponderEvent) => void
}) {
  const calendarDate = getCalendarDate(entry)
  const hasCalendarDate = Boolean(calendarDate)
  const accentColor = badgeColors[entry.status]
  const moderationBadge = getModerationBadge(entry.moderationState, colors)
  const location = getLocationLabel(entry)
  const travelPeriod = getTravelPeriodLabel(entry)
  const explicitDate = getExplicitTravelStatusDate(entry)
  const isWishlist = entry.status === 'wishlist'
  const dateMetaLabel = explicitDate
    ? i18nT('calendar:components.screens.calendar.calendarScreen_parts.data_value1_c4a5ab0c', { value1: explicitDate })
    : isWishlist
      ? i18nT('calendar:components.screens.calendar.calendarScreen_parts.lichnyy_status_bez_daty_fd9e801a')
    : travelPeriod
      ? i18nT('calendar:components.screens.calendar.calendarScreen_parts.tochnaya_data_ne_ukazana_68022bfe')
      : i18nT('calendar:components.screens.calendar.calendarScreen_parts.data_ne_ukazana_cf2122a8')

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
                  {i18nT('calendar:components.screens.calendar.calendarScreen_parts.god_mesyats_4b45d53c')}{travelPeriod}
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
        style={[styles.removeBadge, globalFocusStyles.focusable]}
        onPress={(event) => onRemove(entry, event)}
        accessibilityRole="button"
        accessibilityLabel={i18nT('calendar:components.screens.calendar.calendarScreen_parts.ubrat_value1_iz_kalendarya_98ed1985', { value1: cleanTravelTitle(entry.title, entry.country) })}
        {...(Platform.OS === 'web' ? ({ 'data-card-action': 'true' } as any) : null)}
      >
        <Feather name="trash-2" size={15} color={colors.danger} />
      </Pressable>

      {moderationBadge && (
        <View
          style={[
            styles.moderationBadge,
            { backgroundColor: moderationBadge.background, borderColor: moderationBadge.border },
          ]}
          accessibilityLabel={moderationBadge.label}
          {...(Platform.OS === 'web' ? ({ 'aria-label': moderationBadge.label } as any) : null)}
        >
          <Feather name={moderationBadge.icon} size={11} color={moderationBadge.text} />
          <Text style={[styles.moderationBadgeText, { color: moderationBadge.text }]}>
            {moderationBadge.label}
          </Text>
        </View>
      )}

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
        accessibilityLabel={isWishlist ? i18nT('calendar:components.screens.calendar.calendarScreen_parts.izmenit_status_0823b656') : hasCalendarDate ? i18nT('calendar:components.screens.calendar.calendarScreen_parts.izmenit_datu_value1_234c04d5', { value1: calendarDate }) : i18nT('calendar:components.screens.calendar.calendarScreen_parts.dobavit_datu_6851e94d')}
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
          {isWishlist ? i18nT('calendar:components.screens.calendar.calendarScreen_parts.status_4f449c9a') : calendarDate ?? i18nT('calendarStatic:dateFallback')}
        </Text>
      </Pressable>
    </View>
  )
})

export function DateEditorModal({
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
      <KeyboardAvoidingView
        style={styles.modalKeyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{i18nT('calendar:components.screens.calendar.calendarScreen_parts.status_v_kalendare_909c44a4')}</Text>
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
                  placeholder={i18nT('calendar:components.screens.calendar.calendarScreen_parts.gggg_mm_dd_8d160578')}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  accessibilityLabel={i18nT('calendar:components.screens.calendar.calendarScreen_parts.data_puteshestviya_6acb7ff3')}
                />
              )
            ) : (
              <View style={styles.statusNoteBox}>
                <Feather name="bookmark" size={14} color={colors.textMuted} />
                <Text style={styles.statusNoteText}>{i18nT('calendar:components.screens.calendar.calendarScreen_parts.dlya_statusa_hochu_dostatochno_prosto_sohran_23fb4882')}</Text>
              </View>
            )}

            {!!editor?.error && <Text style={styles.dateError}>{editor.error}</Text>}

            <View style={styles.dateActions}>
              {canClearDate && (
                <Pressable
                  style={[styles.dateSecondaryButton, globalFocusStyles.focusable]}
                  onPress={onClear}
                  accessibilityRole="button"
                  accessibilityLabel={i18nT('calendar:components.screens.calendar.calendarScreen_parts.ubrat_datu_974ef33b')}
                >
                  <Text style={styles.dateSecondaryText}>{i18nT('calendar:components.screens.calendar.calendarScreen_parts.ubrat_datu_974ef33b')}</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.dateSecondaryButton, globalFocusStyles.focusable]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={i18nT('calendar:components.screens.calendar.calendarScreen_parts.otmena_682370b1')}
              >
                <Text style={styles.dateSecondaryText}>{i18nT('calendar:components.screens.calendar.calendarScreen_parts.otmena_682370b1')}</Text>
              </Pressable>
              <Pressable
                style={[styles.datePrimaryButton, globalFocusStyles.focusable]}
                onPress={onSave}
                accessibilityRole="button"
                accessibilityLabel={needsDateInput ? i18nT('calendar:components.screens.calendar.calendarScreen_parts.sohranit_datu_1b3c3b1d') : i18nT('calendar:components.screens.calendar.calendarScreen_parts.sohranit_status_953d4a48')}
              >
                <Text style={styles.datePrimaryText}>{needsDateInput ? i18nT('calendar:components.screens.calendar.calendarScreen_parts.sohranit_0afc03f9') : i18nT('calendar:components.screens.calendar.calendarScreen_parts.sohranit_status_953d4a48')}</Text>
              </Pressable>
            </View>

            {canRemoveStatus && (
              <Pressable
                style={[styles.dateDangerButton, globalFocusStyles.focusable]}
                onPress={onRemove}
                accessibilityRole="button"
                accessibilityLabel={i18nT('calendar:components.screens.calendar.calendarScreen_parts.udalit_iz_kalendarya_0cdea23e')}
              >
                <Feather name="trash-2" size={15} color={colors.danger} />
                <Text style={styles.dateDangerText}>{i18nT('calendar:components.screens.calendar.calendarScreen_parts.udalit_iz_kalendarya_0cdea23e')}</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export function CalendarSkeleton({
  styles,
  showHeader,
  seoBlock,
  onBackPress,
  breadcrumbs,
  onBreadcrumbPress,
}: {
  styles: CalendarStyles
  showHeader?: boolean
  seoBlock: React.ReactNode
  onBackPress: () => void
  breadcrumbs?: ProfileCollectionBreadcrumb[]
  onBreadcrumbPress?: (path: string) => void
}) {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {seoBlock}
      {showHeader && (
        <ProfileCollectionHeader
          title={i18nT('calendar:components.screens.calendar.calendarScreen_parts.moy_kalendar_c73f20df')}
          onBackPress={onBackPress}
          breadcrumbs={breadcrumbs}
          onBreadcrumbPress={onBreadcrumbPress}
          dense
        />
      )}
      <View style={styles.skeletonWrap}>
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonLoader key={index} width="100%" height={200} borderRadius={12} />
        ))}
      </View>
    </SafeAreaView>
  )
}
