import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Platform,
  PanResponder,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useAuth } from '@/context/AuthContext'
import { parseTravelStatusDateParts, useTravelStatusStore, type TravelStatus } from '@/stores/travelStatusStore'
import MiniCalendar from '@/components/calendar/MiniCalendar'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useThemedColors } from '@/hooks/useTheme'
import { useBreakpoints } from '@/hooks/useResponsive'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { globalFocusStyles } from '@/styles/globalFocus'
import { showToast } from '@/utils/toast'
import { translate as i18nT } from '@/i18n'


const STATUS_OPTIONS: Array<{
  key: TravelStatus
  label: string
  icon: React.ComponentProps<typeof Feather>['name']
  hint: string
}> = [
  {
    key: 'visited',
    get label() { return i18nT('travel:components.travel.TravelStatusButton.option.visited.label') },
    icon: 'check-circle',
    get hint() { return i18nT('travel:components.travel.TravelStatusButton.option.visited.hint') },
  },
  {
    key: 'planned',
    get label() { return i18nT('travel:components.travel.TravelStatusButton.option.planned.label') },
    icon: 'calendar',
    get hint() { return i18nT('travel:components.travel.TravelStatusButton.option.planned.hint') },
  },
  {
    key: 'wishlist',
    get label() { return i18nT('travel:components.travel.TravelStatusButton.option.wishlist.label') },
    icon: 'bookmark',
    get hint() { return i18nT('travel:components.travel.TravelStatusButton.option.wishlist.hint') },
  },
]

type Props = {
  travelId: string | number
  travelTitle: string
  travelUrl: string
  travelImageUrl?: string
  travelCountry?: string
  travelCity?: string
  travelYear?: string
  travelMonth?: string | string[]
  travelMonthName?: string
  /** Компактный режим: иконка + короткий видимый статус, стиль как у FavoriteButton variant="overlay" */
  compact?: boolean
  idleLabel?: string
  style?: StyleProp<ViewStyle>
}

/** Валидация ISO-даты YYYY-MM-DD */
const isValidDate = (val: string) => {
  return parseTravelStatusDateParts(val) !== null
}

const stopWebCardEvent = (e?: any) => {
  if (Platform.OS !== 'web') return
  e?.preventDefault?.()
  e?.stopPropagation?.()
  e?.nativeEvent?.stopPropagation?.()
  e?.nativeEvent?.stopImmediatePropagation?.()
}

const stopWebCardPropagation = (e?: any) => {
  if (Platform.OS !== 'web') return
  e?.stopPropagation?.()
  e?.nativeEvent?.stopPropagation?.()
  e?.nativeEvent?.stopImmediatePropagation?.()
}

export default function TravelStatusButton({
  travelId,
  travelTitle,
  travelUrl,
  travelImageUrl,
  travelCountry,
  travelCity,
  travelYear,
  travelMonth,
  travelMonthName,
  compact = false,
  idleLabel,
  style,
}: Props) {
  const colors = useThemedColors()
  const { isMobile } = useBreakpoints()
  const { isAuthenticated, userId } = useAuth()
  const { requireAuth } = useRequireAuth({ intent: 'calendar' })

  const { getStatus, setStatus, removeStatus } = useTravelStatusStore()
  const current = getStatus(travelId)

  const [modalOpen, setModalOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [datePicking, setDatePicking] = useState(false)
  const [dateInput, setDateInput] = useState('')
  const [dateError, setDateError] = useState('')
  const inFlightRef = useRef(false)

  const handleMainPress = useCallback((e?: any) => {
    stopWebCardEvent(e)
    if (!isAuthenticated) {
      requireAuth()
      return
    }
    setDatePicking(false)
    setDateInput(current?.plannedDate ?? '')
    setDateError('')
    setModalOpen(true)
  }, [isAuthenticated, requireAuth, current?.plannedDate])

  const handleSelectStatus = useCallback(async (status: TravelStatus) => {
    if (status === 'planned') {
      setDateInput(current?.plannedDate ?? '')
      setDateError('')
      setDatePicking(true)
      return
    }
    setModalOpen(false)
    setDatePicking(false)
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      await setStatus(
        {
          id: travelId,
          type: 'travel',
          title: travelTitle,
          url: travelUrl,
          imageUrl: travelImageUrl,
          country: travelCountry,
          city: travelCity,
          travelYear,
          travelMonth,
          travelMonthName,
          status,
        },
        userId
      )
      const label = STATUS_OPTIONS.find((o) => o.key === status)?.label ?? status
      await showToast({ type: 'success', text1: label, position: 'bottom', visibilityTime: 2000 })
    } catch {
      await showToast({ type: 'error', text1: i18nT('travel:components.travel.TravelStatusButton.oshibka_1066f04c'), text2: i18nT('travel:components.travel.TravelStatusButton.ne_udalos_sohranit_status_4cf7d143'), position: 'bottom' })
    } finally {
      inFlightRef.current = false
    }
  }, [travelId, travelTitle, travelUrl, travelImageUrl, travelCountry, travelCity, travelYear, travelMonth, travelMonthName, userId, setStatus, current?.plannedDate])

  const handleCalendarDateSelect = useCallback((value: string) => {
    setDateInput(value)
    setDateError('')
  }, [])

  const handleConfirmDate = useCallback(async () => {
    if (!dateInput) {
      setDateError(i18nT('travel:components.travel.TravelStatusButton.ukazhite_datu_da202fa5'))
      return
    }
    if (!isValidDate(dateInput)) {
      setDateError(i18nT('travel:components.travel.TravelStatusButton.vvedite_datu_v_formate_gggg_mm_dd_37344e46'))
      return
    }
    setModalOpen(false)
    setDatePicking(false)
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      await setStatus(
        {
          id: travelId,
          type: 'travel',
          title: travelTitle,
          url: travelUrl,
          imageUrl: travelImageUrl,
          country: travelCountry,
          city: travelCity,
          travelYear,
          travelMonth,
          travelMonthName,
          status: 'planned',
          plannedDate: dateInput,
        },
        userId
      )
      await showToast({ type: 'success', text1: i18nT('travel:components.travel.TravelStatusButton.dobavleno_v_plany_dfb57b79'), text2: dateInput, position: 'bottom', visibilityTime: 2000 })
    } catch {
      await showToast({ type: 'error', text1: i18nT('travel:components.travel.TravelStatusButton.oshibka_1066f04c'), text2: i18nT('travel:components.travel.TravelStatusButton.ne_udalos_sohranit_1db862ee'), position: 'bottom' })
    } finally {
      inFlightRef.current = false
    }
  }, [travelId, travelTitle, travelUrl, travelImageUrl, travelCountry, travelCity, travelYear, travelMonth, travelMonthName, userId, setStatus, dateInput])

  const handleRemove = useCallback(async () => {
    setModalOpen(false)
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      await removeStatus(travelId, userId)
      await showToast({ type: 'info', text1: i18nT('travel:components.travel.TravelStatusButton.udaleno_iz_plana_91e9ba44'), position: 'bottom', visibilityTime: 2000 })
    } catch {
      /* noop */
    } finally {
      inFlightRef.current = false
    }
  }, [travelId, userId, removeStatus])

  const currentOption = current ? STATUS_OPTIONS.find((o) => o.key === current.status) : null

  const compactStyles = useMemo(() => StyleSheet.create({
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      minHeight: 44,
      minWidth: 44,
      maxWidth: 174,
      ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', cursor: 'pointer' } as any : {}),
    },
    text: {
      color: colors.textOnDark,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      flexShrink: 1,
    },
  }), [colors.textOnDark])

  const styles = useMemo(() => StyleSheet.create({
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 12,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: current ? colors.primaryLight : colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: current ? colors.primary : colors.borderLight,
      minHeight: 44,
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
    },
    btnText: {
      fontSize: 15,
      fontWeight: '600',
      color: current ? colors.primary : colors.primaryText,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
      alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
      padding: Platform.OS === 'web' ? 20 : 0,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: DESIGN_TOKENS.radii.xl,
      borderTopRightRadius: DESIGN_TOKENS.radii.xl,
      paddingTop: 8,
      paddingBottom: Platform.OS === 'ios' ? 36 : 24,
      maxHeight: '80%',
      ...(Platform.OS === 'web'
        ? {
            width: 'min(520px, calc(100vw - 40px))',
            borderBottomLeftRadius: DESIGN_TOKENS.radii.xl,
            borderBottomRightRadius: DESIGN_TOKENS.radii.xl,
            boxShadow: DESIGN_TOKENS.shadows.heavy,
          } as any
        : null),
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderLight,
      alignSelf: 'center',
      marginBottom: 16,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 20,
      paddingRight: 8,
      marginBottom: 12,
    },
    sheetTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    closeBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 20,
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
    },
    optionActive: {
      backgroundColor: colors.primaryLight,
    },
    optionIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    optionIconWrapActive: {
      backgroundColor: colors.primaryLight,
    },
    optionLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    optionHint: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 1,
    },
    optionCheck: {
      marginLeft: 'auto' as any,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginHorizontal: 20,
      marginVertical: 4,
    },
    removeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 20,
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
    },
    removeText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.danger,
    },
    dateSection: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 8,
    },
    dateSectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    dateSectionHint: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
      marginBottom: 10,
    },
    calendarWrap: {
      marginHorizontal: -16,
    },
    selectedDateBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: dateInput ? colors.primaryLight : colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: dateInput ? colors.primary : colors.borderLight,
      marginTop: 2,
    },
    selectedDateText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    dateError: {
      fontSize: 12,
      color: colors.danger,
      marginTop: 4,
    },
    dateActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    dateCancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: DESIGN_TOKENS.radii.pill,
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    dateCancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    dateConfirmBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: DESIGN_TOKENS.radii.pill,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    dateConfirmText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.surface,
    },
  }), [colors, current, dateInput])

  // Swipe-down-to-dismiss on the sheet header/grabber (native only; web uses ✕ / tap-outside).
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Platform.OS !== 'web' && gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dy > 60 || gesture.vy > 0.5) {
            setModalOpen(false)
          }
        },
      }),
    []
  )

  // --- modal JSX (shared between compact and full) ---
  const modalJsx = (
    <Modal
      visible={modalOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setModalOpen(false)}
    >
      <Pressable style={styles.overlay} onPress={() => setModalOpen(false)}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View {...panResponder.panHandlers}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.sheetTitle}>
                {datePicking ? i18nT('travel:components.travel.TravelStatusButton.ukazhite_datu_poezdki_1a5b34eb') : i18nT('travel:components.travel.TravelStatusButton.dobavit_v_plan_c8d5333c')}
              </Text>
              <Pressable
                style={[styles.closeBtn, globalFocusStyles.focusable]}
                onPress={() => setModalOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={i18nT('travel:components.travel.TravelStatusButton.zakryt_ee95ca3d')}
                hitSlop={8}
              >
                <Feather name="x" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {!datePicking ? (
            <ScrollView bounces={false}>
              {STATUS_OPTIONS.map((opt) => {
                const isActive = current?.status === opt.key
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.option, isActive && styles.optionActive, globalFocusStyles.focusable]}
                    onPress={() => handleSelectStatus(opt.key)}
                    accessibilityRole="button"
                    accessibilityLabel={opt.label}
                    accessibilityHint={opt.hint}
                    accessibilityState={{ selected: isActive }}
                  >
                    <View style={[styles.optionIconWrap, isActive && styles.optionIconWrapActive]}>
                      <Feather name={opt.icon} size={20} color={isActive ? colors.primary : colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, isActive && { color: colors.primaryText }]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.optionHint}>{opt.hint}</Text>
                    </View>
                    {isActive && (
                      <Feather name="check" size={18} color={colors.primaryDark} style={styles.optionCheck} />
                    )}
                  </Pressable>
                )
              })}

              {current && (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    style={[styles.removeRow, globalFocusStyles.focusable]}
                    onPress={handleRemove}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('travel:components.travel.TravelStatusButton.ubrat_iz_plana_3eacfe85')}
                  >
                    <Feather name="trash-2" size={18} color={colors.danger} />
                    <Text style={styles.removeText}>{i18nT('travel:components.travel.TravelStatusButton.ubrat_iz_plana_3eacfe85')}</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          ) : (
            <View style={styles.dateSection}>
              <Text style={styles.dateSectionTitle}>{i18nT('travel:components.travel.TravelStatusButton.data_poezdki_240d7a94')}</Text>
              <Text style={styles.dateSectionHint}>{i18nT('travel:components.travel.TravelStatusButton.vyberite_den_v_kalendare_0b5e3516')}</Text>
              <View style={styles.calendarWrap}>
                <MiniCalendar
                  entries={[]}
                  selectedDate={dateInput || null}
                  focusDate={dateInput || current?.plannedDate || null}
                  onDayPress={handleCalendarDateSelect}
                  accentColor={colors.primary}
                  accentSoftColor={colors.primaryLight}
                />
              </View>
              <View style={styles.selectedDateBox}>
                <Feather name="calendar" size={15} color={dateInput ? colors.primary : colors.textMuted} />
                <Text style={styles.selectedDateText}>
                  {dateInput ? i18nT('travel:components.travel.TravelStatusButton.vybrano_value1_35052aee', { value1: dateInput }) : i18nT('travel:components.travel.TravelStatusButton.data_ne_vybrana_40b85060')}
                </Text>
              </View>
              {!!dateError && <Text style={styles.dateError}>{dateError}</Text>}
              <View style={styles.dateActions}>
                <Pressable
                  style={[styles.dateCancelBtn, globalFocusStyles.focusable]}
                  onPress={() => setDatePicking(false)}
                  accessibilityRole="button"
                  accessibilityLabel={i18nT('travel:components.travel.TravelStatusButton.nazad_k_vyboru_statusa_582b29fd')}
                >
                  <Text style={styles.dateCancelText}>{i18nT('travel:components.travel.TravelStatusButton.nazad_ef2effb6')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.dateConfirmBtn, globalFocusStyles.focusable]}
                  onPress={handleConfirmDate}
                  accessibilityRole="button"
                  accessibilityLabel={i18nT('travel:components.travel.TravelStatusButton.sohranit_datu_ef1c2904')}
                >
                  <Text style={styles.dateConfirmText}>{i18nT('travel:components.travel.TravelStatusButton.sohranit_0d739b23')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )

  // Compact mode — small overlay button with a visible status label.
  if (compact) {
    const compactAccessibilityLabel = currentOption ? currentOption.label : i18nT('travel:components.travel.TravelStatusButton.dobavit_v_plan_c8d5333c')
    const compactLabel = currentOption?.label ?? idleLabel ?? null
    const compactIcon = (
      <Feather
        name={currentOption?.icon ?? 'plus-circle'}
        size={20}
        color={current ? colors.primary : 'rgba(255, 255, 255, 0.85)'}
      />
    )

    if (Platform.OS === 'web') {
      // Icon-only by default; the label reveals on hover — desktop web only.
      const showCompactLabel = Boolean(compactLabel) && !isMobile && hovered
      return (
        <>
          <View
            style={[compactStyles.btn, globalFocusStyles.focusable]}
            {...({
              tabIndex: 0,
              role: 'button',
              'aria-label': compactAccessibilityLabel,
              'aria-pressed': Boolean(current),
              title: i18nT('travel:components.travel.TravelStatusButton.upravlenie_statusom_puteshestviya_443c9fae'),
              'data-card-action': 'true',
              onClick: handleMainPress,
              onMouseEnter: isMobile ? undefined : () => setHovered(true),
              onMouseLeave: isMobile ? undefined : () => setHovered(false),
              onMouseDown: stopWebCardPropagation,
              onMouseUp: stopWebCardPropagation,
              onPointerDown: stopWebCardPropagation,
              onPointerUp: stopWebCardPropagation,
              onTouchStart: stopWebCardPropagation,
              onTouchEnd: stopWebCardPropagation,
              onKeyDown: (e: any) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleMainPress(e)
                }
              },
            } as any)}
          >
            {compactIcon}
            {showCompactLabel ? (
              <Text style={compactStyles.text} numberOfLines={1}>
                {compactLabel}
              </Text>
            ) : null}
          </View>
          {modalJsx}
        </>
      )
    }

    // Native (mobile) — icon-only, no label.
    return (
      <>
        <Pressable
          style={[compactStyles.btn, globalFocusStyles.focusable]}
          onPress={handleMainPress}
          accessibilityRole="button"
          accessibilityLabel={compactAccessibilityLabel}
          accessibilityHint={i18nT('travel:components.travel.TravelStatusButton.upravlenie_statusom_puteshestviya_443c9fae')}
          hitSlop={6}
        >
          {compactIcon}
        </Pressable>
        {modalJsx}
      </>
    )
  }

  return (
    <>
      <Pressable
        style={[styles.btn, globalFocusStyles.focusable, style]}
        onPress={handleMainPress}
        accessibilityRole="button"
        accessibilityLabel={currentOption ? currentOption.label : (idleLabel ?? i18nT('travel:components.travel.TravelStatusButton.addToPlanFallback'))}
        accessibilityHint={i18nT('travel:components.travel.TravelStatusButton.upravlenie_statusom_puteshestviya_443c9fae')}
      >
        <Feather
          name={currentOption?.icon ?? 'plus-circle'}
          size={20}
          color={current ? colors.primary : colors.textMuted}
        />
        <Text style={styles.btnText}>
          {currentOption?.label ?? idleLabel ?? i18nT('travel:components.travel.TravelStatusButton.addToPlanFallback')}
        </Text>
        {current && current.status === 'planned' && current.plannedDate && (
          <Text style={[styles.btnText, { fontWeight: '400', fontSize: 13, color: colors.textSecondary }]}>
            · {current.plannedDate}
          </Text>
        )}
      </Pressable>

      {modalJsx}
    </>
  )
}
