import { memo, useEffect, useMemo, useRef } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import {
  useMyGamificationProgress,
  useUserGamificationProgress,
} from '@/hooks/useGamification'
import { useAuthStore } from '@/stores/authStore'
import { trackProgressionLevelUp } from '@/utils/gamificationAnalytics'
import ProgressionLineBar from '@/components/achievements/ProgressionLineBar'
import SectionState from '@/components/achievements/SectionState'
import { translate as i18nT } from '@/i18n'


interface Props {
  /** userId — публичный профиль автора; не задан — собственный профиль (/me/). */
  userId?: string | number | null
  /** bare — без внешней карточки (мини-заголовок остаётся; контент для хаба наград). */
  bare?: boolean
  onOpenAwards?: () => void
  testID?: string
  style?: StyleProp<ViewStyle>
}

/**
 * 4 типа активности (Исследователь/Читатель/Автор/Участник) с их RPG-линейками
 * (Собачья/Кабанья/Лисья/Птичья) в профиле. FE-progression-bar + FE-activity-types-ui.
 */
function ActivityProgressionSection({
  userId,
  bare = false,
  onOpenAwards,
  testID,
  style,
}: Props) {
  const colors = useThemedColors()
  const isOwn = userId == null
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const ownQuery = useMyGamificationProgress()
  const userQuery = useUserGamificationProgress(isOwn ? null : userId)
  const { data, isFetching, isError } = isOwn ? ownQuery : userQuery

  // Только для собственного профиля: трекаем level-up по росту уровня между рефетчами.
  const prevLevels = useRef<Record<string, number>>({})
  useEffect(() => {
    if (!isOwn || !data) return
    for (const line of data.lines) {
      const prev = prevLevels.current[line.slug]
      if (prev != null && line.level > prev) {
        trackProgressionLevelUp({
          lineSlug: line.slug,
          activityKind: line.activityKind,
          newLevel: line.level,
        })
      }
      prevLevels.current[line.slug] = line.level
    }
  }, [isOwn, data])

  const styles = useMemo(() => getStyles(colors), [colors])

  const hasData = data != null && data.lines.length > 0

  if (isError) return null
  if (isOwn && !isAuthenticated) return null
  // Не fetching и нечего показать (disabled/idle/пусто) — секция необязательная.
  if (!isFetching && !hasData) return null

  return (
    <View style={[bare ? styles.bare : styles.card, style]} testID={testID}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>{i18nT('achievements:components.achievements.ActivityProgressionSection.tropy_razvitiya_7e50bca2')}</Text>
          <Text style={styles.subheading} numberOfLines={2}>
            {i18nT('achievements:components.achievements.ActivityProgressionSection.uroven_rastet_za_marshruty_chtenie_poezdki_i_14628b3a')}</Text>
        </View>
        {onOpenAwards ? (
          <Pressable
            onPress={onOpenAwards}
            accessibilityRole="button"
            accessibilityLabel={i18nT('achievements:components.achievements.ActivityProgressionSection.otkryt_vse_nagrady_6272585c')}
            style={({ pressed }) => [
              styles.awardsButton,
              pressed && { opacity: 0.78 },
            ]}
          >
            <Feather name="award" size={14} color={colors.primaryDark} />
            <Text style={styles.awardsButtonText}>{i18nT('achievements:components.achievements.ActivityProgressionSection.nagrady_69c61772')}</Text>
            <Feather name="chevron-right" size={14} color={colors.primaryDark} />
          </Pressable>
        ) : null}
      </View>

      <SectionState isFetching={isFetching} hasData={hasData}>
        {data ? (
          <View style={styles.lines}>
            {data.lines.map((line) => (
              <ProgressionLineBar key={line.slug} line={line} />
            ))}
          </View>
        ) : null}
      </SectionState>
    </View>
  )
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      padding: DESIGN_TOKENS.spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    bare: { gap: DESIGN_TOKENS.spacing.sm },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    headerText: { flex: 1, minWidth: 0, gap: 2 },
    heading: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '800',
      color: colors.text,
    },
    subheading: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      lineHeight: 18,
    },
    awardsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundTertiary,
    },
    awardsButtonText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '700',
      color: colors.primaryText,
    },
    lines: { gap: DESIGN_TOKENS.spacing.md },
  })

export default memo(ActivityProgressionSection)
