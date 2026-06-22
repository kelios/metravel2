import { memo, useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Feather } from '@expo/vector-icons'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useMyAchievements } from '@/hooks/useAchievementsApi'
import { useAuthStore } from '@/stores/authStore'
import type { MyAchievements, UserBadge } from '@/api/achievements'
import BadgeMedal from '@/components/achievements/BadgeMedal'
import BadgeDetailSheet, {
  type BadgeDetail,
} from '@/components/achievements/BadgeDetailSheet'
import AchievementsGalleryModal from '@/components/achievements/AchievementsGalleryModal'
import SectionState from '@/components/achievements/SectionState'
import { formatRelativeTime } from '@/utils/relativeTime'

interface Props {
  testID?: string
  style?: StyleProp<ViewStyle>
}

const FALLBACK_LIMIT = 8

/** Лента из recentlyEarned; если BE её не отдал — последние earned по дате. */
const pickRecent = (data: MyAchievements): UserBadge[] => {
  if (data.recentlyEarned.length > 0) return data.recentlyEarned
  return [...data.earned]
    .sort((a, b) => Date.parse(b.earnedAt) - Date.parse(a.earnedAt))
    .slice(0, FALLBACK_LIMIT)
}

function RecentAwardsTab({ testID, style }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const ownerName = useAuthStore((s) => s.username)
  const { data, isFetching } = useMyAchievements()
  const [detail, setDetail] = useState<BadgeDetail | null>(null)
  const [galleryOpen, setGalleryOpen] = useState(false)

  const items = useMemo(() => (data ? pickRecent(data) : []), [data])

  if (!isAuthenticated) {
    return (
      <Text style={styles.empty}>
        Войдите, чтобы видеть свои награды.
      </Text>
    )
  }

  return (
    <View style={[styles.wrap, style]} testID={testID}>
      {data && items.length > 0 ? (
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => setGalleryOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Как это достигнуто"
            style={styles.howBtn}
            testID="recent-awards-how"
          >
            <Feather name="help-circle" size={14} color={colors.primary} />
            <Text style={styles.howText}>Как это достигнуто</Text>
          </Pressable>
        </View>
      ) : null}

      <SectionState
        isFetching={isFetching}
        hasData={data != null}
        emptyText="Пока нет новых наград — всё впереди."
      >
        {data && items.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
          >
            {items.map((ub) => {
              const at = Date.parse(ub.earnedAt)
              const when = Number.isFinite(at) ? formatRelativeTime(at) : ''
              return (
                <Pressable
                  key={ub.id}
                  onPress={() =>
                    setDetail({
                      badge: ub.badge,
                      earned: true,
                      userBadgeId: ub.id,
                      earnedAt: ub.earnedAt,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${ub.badge.name}${when ? `, ${when}` : ''}`}
                  testID={`recent-award-${ub.badge.id}`}
                  style={styles.item}
                >
                  <BadgeMedal badge={ub.badge} size={56} earned showLabel />
                  {when ? <Text style={styles.when}>{when}</Text> : null}
                </Pressable>
              )
            })}
          </ScrollView>
        ) : (
          <Text style={styles.empty}>Пока нет новых наград — всё впереди.</Text>
        )}
      </SectionState>

      <BadgeDetailSheet
        visible={detail != null}
        onClose={() => setDetail(null)}
        detail={detail}
        ownerName={ownerName}
      />

      {data ? (
        <AchievementsGalleryModal
          visible={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          data={data}
          ownerName={ownerName}
        />
      ) : null}
    </View>
  )
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    wrap: { gap: DESIGN_TOKENS.spacing.xs },
    headerRow: { flexDirection: 'row', justifyContent: 'flex-end' },
    howBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    howText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.primary,
    },
    row: {
      gap: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 2,
      paddingRight: 8,
    },
    item: { alignItems: 'center' },
    when: {
      marginTop: 2,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 64,
    },
    empty: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      lineHeight: 20,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
    },
  })

export default memo(RecentAwardsTab)
