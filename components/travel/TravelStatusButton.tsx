import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useAuth } from '@/context/AuthContext'
import { useTravelStatusStore, type TravelStatus } from '@/stores/travelStatusStore'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { globalFocusStyles } from '@/styles/globalFocus'
import { showToast } from '@/utils/toast'

const STATUS_OPTIONS: Array<{
  key: TravelStatus
  label: string
  icon: React.ComponentProps<typeof Feather>['name']
  hint: string
}> = [
  { key: 'visited', label: 'Был здесь', icon: 'check-circle', hint: 'Уже посетил это место' },
  { key: 'planned', label: 'Планирую', icon: 'calendar', hint: 'Собираюсь поехать' },
  { key: 'wishlist', label: 'Хочу поехать', icon: 'bookmark', hint: 'В списке желаний' },
]

type Props = {
  travelId: string | number
  travelTitle: string
  travelUrl: string
  travelImageUrl?: string
  travelCountry?: string
  travelCity?: string
  /** Компактный режим: только иконка, стиль как у OptimizedFavoriteButton */
  compact?: boolean
}

/** Валидация ISO-даты YYYY-MM-DD */
const isValidDate = (val: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false
  const d = new Date(val)
  return !isNaN(d.getTime())
}

const stopWebCardEvent = (e?: any) => {
  if (Platform.OS !== 'web') return
  e?.preventDefault?.()
  e?.stopPropagation?.()
  e?.nativeEvent?.stopPropagation?.()
  e?.nativeEvent?.stopImmediatePropagation?.()
}

/** Нативный HTML date-input для web */
function WebDateInput({
  value,
  onChange,
  style,
}: {
  value: string
  onChange: (v: string) => void
  style?: object
}) {
  if (Platform.OS !== 'web') return null
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '10px 12px',
        fontSize: 15,
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        backgroundColor: '#fff',
        color: '#1a202c',
        outline: 'none',
        boxSizing: 'border-box',
        ...style,
      } as React.CSSProperties}
    />
  )
}

export default function TravelStatusButton({
  travelId,
  travelTitle,
  travelUrl,
  travelImageUrl,
  travelCountry,
  travelCity,
  compact = false,
}: Props) {
  const colors = useThemedColors()
  const { isAuthenticated, userId } = useAuth()
  const { requireAuth } = useRequireAuth({ intent: 'calendar' })

  const { getStatus, setStatus, removeStatus } = useTravelStatusStore()
  const current = getStatus(travelId)

  const [modalOpen, setModalOpen] = useState(false)
  const [datePicking, setDatePicking] = useState(false)
  const [dateInput, setDateInput] = useState('')
  const [dateError, setDateError] = useState('')
  const pendingStatusRef = useRef<TravelStatus | null>(null)

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
      pendingStatusRef.current = 'planned'
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
          status,
        },
        userId
      )
      const label = STATUS_OPTIONS.find((o) => o.key === status)?.label ?? status
      await showToast({ type: 'success', text1: label, position: 'bottom', visibilityTime: 2000 })
    } catch {
      await showToast({ type: 'error', text1: 'Ошибка', text2: 'Не удалось сохранить статус', position: 'bottom' })
    } finally {
      inFlightRef.current = false
    }
  }, [travelId, travelTitle, travelUrl, travelImageUrl, travelCountry, travelCity, userId, setStatus, current?.plannedDate])

  const handleConfirmDate = useCallback(async () => {
    if (!dateInput) {
      setDateError('Укажите дату')
      return
    }
    if (!isValidDate(dateInput)) {
      setDateError('Введите дату в формате ГГГГ-ММ-ДД')
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
          status: 'planned',
          plannedDate: dateInput,
        },
        userId
      )
      await showToast({ type: 'success', text1: 'Добавлено в планы', text2: dateInput, position: 'bottom', visibilityTime: 2000 })
    } catch {
      await showToast({ type: 'error', text1: 'Ошибка', text2: 'Не удалось сохранить', position: 'bottom' })
    } finally {
      inFlightRef.current = false
    }
  }, [travelId, travelTitle, travelUrl, travelImageUrl, travelCountry, travelCity, userId, setStatus, dateInput])

  const handleRemove = useCallback(async () => {
    setModalOpen(false)
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      await removeStatus(travelId, userId)
      await showToast({ type: 'info', text1: 'Удалено из плана', position: 'bottom', visibilityTime: 2000 })
    } catch {
      /* noop */
    } finally {
      inFlightRef.current = false
    }
  }, [travelId, userId, removeStatus])

  const currentOption = current ? STATUS_OPTIONS.find((o) => o.key === current.status) : null

  const compactStyles = useMemo(() => StyleSheet.create({
    btn: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 44,
      ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', cursor: 'pointer' } as any : {}),
    },
  }), [])

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
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: DESIGN_TOKENS.radii.xl,
      borderTopRightRadius: DESIGN_TOKENS.radii.xl,
      paddingTop: 8,
      paddingBottom: Platform.OS === 'ios' ? 36 : 24,
      maxHeight: '80%',
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderLight,
      alignSelf: 'center',
      marginBottom: 16,
    },
    sheetTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: 20,
      marginBottom: 12,
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
      marginBottom: 10,
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
  }), [colors, current])

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
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>
            {datePicking ? 'Укажите дату поездки' : 'Добавить в план'}
          </Text>

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
                    accessibilityState={{ selected: isActive }}
                  >
                    <View style={[styles.optionIconWrap, isActive && styles.optionIconWrapActive]}>
                      <Feather name={opt.icon} size={20} color={isActive ? colors.primary : colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, isActive && { color: colors.primary }]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.optionHint}>{opt.hint}</Text>
                    </View>
                    {isActive && (
                      <Feather name="check" size={18} color={colors.primary} style={styles.optionCheck} />
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
                    accessibilityLabel="Убрать из плана"
                  >
                    <Feather name="trash-2" size={18} color={colors.danger} />
                    <Text style={styles.removeText}>Убрать из плана</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          ) : (
            <View style={styles.dateSection}>
              <Text style={styles.dateSectionTitle}>Дата поездки</Text>
              {Platform.OS === 'web' ? (
                <WebDateInput value={dateInput} onChange={setDateInput} />
              ) : (
                <TextInput
                  style={styles.dateInput}
                  value={dateInput}
                  onChangeText={(v) => { setDateInput(v); setDateError('') }}
                  placeholder="ГГГГ-ММ-ДД"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  accessibilityLabel="Дата поездки"
                />
              )}
              {!!dateError && <Text style={styles.dateError}>{dateError}</Text>}
              <View style={styles.dateActions}>
                <Pressable
                  style={[styles.dateCancelBtn, globalFocusStyles.focusable]}
                  onPress={() => setDatePicking(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Отмена"
                >
                  <Text style={styles.dateCancelText}>Отмена</Text>
                </Pressable>
                <Pressable
                  style={[styles.dateConfirmBtn, globalFocusStyles.focusable]}
                  onPress={handleConfirmDate}
                  accessibilityRole="button"
                  accessibilityLabel="Сохранить дату"
                >
                  <Text style={styles.dateConfirmText}>Сохранить</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )

  // Compact mode — icon-only circle button, same visual as OptimizedFavoriteButton
  if (compact) {
    const compactAccessibilityLabel = currentOption ? currentOption.label : 'Добавить в план'
    const compactIcon = (
      <Feather
        name={currentOption?.icon ?? 'plus-circle'}
        size={18}
        color={current ? colors.primary : 'rgba(255, 255, 255, 0.85)'}
      />
    )

    if (Platform.OS === 'web') {
      return (
        <>
          <View
            style={[compactStyles.btn, globalFocusStyles.focusable]}
            {...({
              tabIndex: 0,
              'aria-label': compactAccessibilityLabel,
              'aria-pressed': Boolean(current),
              'data-card-action': 'true',
              onClick: handleMainPress,
              onMouseDown: stopWebCardEvent,
              onMouseUp: stopWebCardEvent,
              onPointerDown: stopWebCardEvent,
              onPointerUp: stopWebCardEvent,
              onTouchStart: stopWebCardEvent,
              onTouchEnd: stopWebCardEvent,
              onKeyDown: (e: any) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleMainPress(e)
                }
              },
            } as any)}
          >
            {compactIcon}
          </View>
          {modalJsx}
        </>
      )
    }

    return (
      <>
        <Pressable
          style={[compactStyles.btn, globalFocusStyles.focusable]}
          onPress={handleMainPress}
          accessibilityRole="button"
          accessibilityLabel={compactAccessibilityLabel}
          accessibilityHint="Управление статусом путешествия"
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
        style={[styles.btn, globalFocusStyles.focusable]}
        onPress={handleMainPress}
        accessibilityRole="button"
        accessibilityLabel={currentOption ? currentOption.label : 'Добавить в план'}
        accessibilityHint="Управление статусом путешествия"
      >
        <Feather
          name={currentOption?.icon ?? 'plus-circle'}
          size={20}
          color={current ? colors.primary : colors.textMuted}
        />
        <Text style={styles.btnText}>
          {currentOption?.label ?? 'Добавить в план'}
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
