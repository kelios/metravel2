import { memo, useEffect, useMemo, useRef } from 'react'
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

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

interface Props {
  /** userId — публичный профиль автора; не задан — собственный профиль (/me/). */
  userId?: string | number | null
  /** bare — без внешней карточки (мини-заголовок остаётся; контент для хаба наград). */
  bare?: boolean
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
      <Text style={styles.heading}>Линейки прогрессии</Text>
      <Text style={styles.subheading}>
        Четыре типа активности — четыре тропы. Чем больше вклад, тем выше
        уровень.
      </Text>

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
    heading: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '800',
      color: colors.text,
    },
    subheading: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      lineHeight: 18,
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    lines: { gap: DESIGN_TOKENS.spacing.md },
  })

export default memo(ActivityProgressionSection)
