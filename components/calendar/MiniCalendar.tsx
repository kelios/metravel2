import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { globalFocusStyles } from '@/styles/globalFocus'
import { getTravelStatusCalendarDate, parseTravelStatusDateParts, type TravelStatusEntry } from '@/stores/travelStatusStore'

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель',
  'Май', 'Июнь', 'Июль', 'Август',
  'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

type Props = {
  entries: TravelStatusEntry[]
  onDayPress?: (dateStr: string) => void
  selectedDate?: string | null
  focusDate?: string | null
  accentColor?: string
  accentSoftColor?: string
}

export default function MiniCalendar({
  entries,
  onDayPress,
  selectedDate,
  focusDate,
  accentColor,
  accentSoftColor,
}: Props) {
  const colors = useThemedColors()
  const markColor = accentColor ?? colors.primary
  const markSoftColor = accentSoftColor ?? colors.primaryLight
  const today = new Date()

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1) // 1-based

  useEffect(() => {
    const focusedParts = parseTravelStatusDateParts(focusDate)
    if (!focusedParts) return

    setYear(focusedParts.year)
    setMonth(focusedParts.month)
  }, [focusDate])

  // ISO-даты с поездками текущего месяца
  const markedDates = useMemo(() => {
    const set = new Set<string>()
    entries.forEach((e) => {
      const calendarDate = getTravelStatusCalendarDate(e)
      const dateParts = parseTravelStatusDateParts(calendarDate)
      if (dateParts?.year === year && dateParts.month === month && calendarDate) {
        set.add(calendarDate)
      }
    })
    return set
  }, [entries, year, month])

  // Первый день недели месяца (0=Mon..6=Sun)
  const firstDayOfWeek = useMemo(() => {
    const d = new Date(year, month - 1, 1)
    return (d.getDay() + 6) % 7 // shift so Monday = 0
  }, [year, month])

  const daysInMonth = useMemo(() =>
    new Date(year, month, 0).getDate(),
  [year, month])

  const prevMonth = useCallback(() => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) }
    else setMonth((m) => m - 1)
  }, [month])

  const nextMonth = useCallback(() => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1) }
    else setMonth((m) => m + 1)
  }, [month])

  const toDayStr = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const todayStr = useMemo(() =>
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
  // computed once on mount: today's date is fixed for the component lifetime
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [])

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
      marginHorizontal: 16,
      marginBottom: 12,
      ...(Platform.OS === 'web'
        ? {
            alignSelf: 'stretch',
          } as any
        : null),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    navBtn: {
      padding: 6,
      borderRadius: DESIGN_TOKENS.radii.sm,
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
    },
    dayNamesRow: {
      flexDirection: 'row',
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 4,
    },
    dayName: {
      flex: 1,
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 8,
      paddingBottom: 12,
    },
    cell: {
      width: `${100 / 7}%` as any,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
    },
    dayBtnToday: {
      borderWidth: 1.5,
      borderColor: markColor,
    },
    dayBtnSelected: {
      backgroundColor: markColor,
    },
    dayBtnMarked: {
      backgroundColor: markSoftColor,
    },
    dayText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    dayTextSelected: {
      color: colors.surface,
      fontWeight: '700',
    },
    dayTextMuted: {
      color: colors.textMuted,
    },
    dot: {
      position: 'absolute',
      bottom: 2,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: markColor,
    },
  }), [colors, markColor, markSoftColor])

  // Build grid cells
  const cells: Array<{ day: number | null }> = useMemo(() => {
    const arr: Array<{ day: number | null }> = []
    for (let i = 0; i < firstDayOfWeek; i++) arr.push({ day: null })
    for (let d = 1; d <= daysInMonth; d++) arr.push({ day: d })
    // pad to multiple of 7
    while (arr.length % 7 !== 0) arr.push({ day: null })
    return arr
  }, [firstDayOfWeek, daysInMonth])

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={[styles.navBtn, globalFocusStyles.focusable]}
          onPress={prevMonth}
          accessibilityRole="button"
          accessibilityLabel="Предыдущий месяц"
        >
          <Feather name="chevron-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <Pressable
          style={[styles.navBtn, globalFocusStyles.focusable]}
          onPress={nextMonth}
          accessibilityRole="button"
          accessibilityLabel="Следующий месяц"
        >
          <Feather name="chevron-right" size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Day names */}
      <View style={styles.dayNamesRow}>
        {DAY_NAMES.map((name) => (
          <Text key={name} style={styles.dayName}>{name}</Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          if (!cell.day) {
            return <View key={`empty-${idx}`} style={styles.cell} />
          }
          const dayStr = toDayStr(cell.day)
          const isToday = dayStr === todayStr
          const isSelected = dayStr === selectedDate
          const isMarked = markedDates.has(dayStr)

          return (
            <View key={dayStr} style={styles.cell}>
              <Pressable
                style={[
                  styles.dayBtn,
                  globalFocusStyles.focusable,
                  isMarked && !isSelected && styles.dayBtnMarked,
                  isToday && !isSelected && styles.dayBtnToday,
                  isSelected && styles.dayBtnSelected,
                ]}
                onPress={() => onDayPress?.(dayStr)}
                accessibilityRole="button"
                accessibilityLabel={`${cell.day} ${MONTH_NAMES[month - 1]}${isMarked ? ', есть поездки' : ''}`}
                accessibilityState={{ selected: isSelected }}
                testID={`mini-calendar-day-${dayStr}`}
              >
                <Text
                  style={[
                    styles.dayText,
                    isSelected && styles.dayTextSelected,
                  ]}
                >
                  {cell.day}
                </Text>
                {isMarked && !isSelected && <View style={styles.dot} />}
              </Pressable>
            </View>
          )
        })}
      </View>
    </View>
  )
}
