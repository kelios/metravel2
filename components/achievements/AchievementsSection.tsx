import { memo, useState } from 'react'
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
import {
  useMyAchievements,
  useUserAchievements,
} from '@/hooks/useAchievementsApi'
import { useAuthStore } from '@/stores/authStore'
import RankBar from '@/components/achievements/RankBar'
import BadgeMedal from '@/components/achievements/BadgeMedal'
import AchievementsGalleryModal from '@/components/achievements/AchievementsGalleryModal'
import PeerBadgeReceivedRow from '@/components/achievements/PeerBadgeReceivedRow'
import SectionState from '@/components/achievements/SectionState'

interface Props {
  /** bare — без внешней карточки и заголовка (контент для хаба наград). */
  bare?: boolean
  testID?: string
  style?: StyleProp<ViewStyle>
}

function AchievementsSection({ bare = false, testID, style }: Props) {
  const colors = useThemedColors()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { data, isFetching, isError } = useMyAchievements()
  const ownUserId = useAuthStore((s) => s.userId)
  const ownerName = useAuthStore((s) => s.username)
  // peer-награды отдаёт user-эндпоинт (не /me/) — тянем по своему id (кэшируется).
  const { data: publicData } = useUserAchievements(ownUserId)
  const peerReceived = publicData?.peerReceived ?? []
  const [galleryOpen, setGalleryOpen] = useState(false)

  const styles = getStyles(colors)

  // Тихо скрываем при ошибке/неавторизованном — секция необязательная.
  if (isError || !isAuthenticated) return null

  const body = (
    <SectionState isFetching={isFetching} hasData={data != null}>
      {data ? (
        <>
          <RankBar rank={data.rank} style={styles.rank} />

          {data.earned.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.medalsRow}
            >
              {data.earned.map((ub) => (
                <BadgeMedal
                  key={ub.badge.id}
                  badge={ub.badge}
                  size={56}
                  earned
                  showLabel
                  onPress={() => setGalleryOpen(true)}
                />
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.empty}>
              Пока нет значков. Публикуйте путешествия и проходите квесты — они
              появятся здесь.
            </Text>
          )}

          {peerReceived.length > 0 ? (
            <PeerBadgeReceivedRow
              items={peerReceived}
              size={56}
              style={styles.peerRow}
            />
          ) : null}

          <AchievementsGalleryModal
            visible={galleryOpen}
            onClose={() => setGalleryOpen(false)}
            data={data}
            ownerName={ownerName}
          />
        </>
      ) : null}
    </SectionState>
  )

  if (bare) {
    return (
      <View style={[styles.bare, style]} testID={testID}>
        {body}
      </View>
    )
  }

  return (
    <View style={[styles.card, style]} testID={testID}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Достижения</Text>
        {data ? (
          <Pressable
            onPress={() => setGalleryOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Открыть все достижения"
            style={styles.allBtn}
          >
            <Text style={styles.allBtnText}>Все</Text>
            <Feather name="chevron-right" size={16} color={colors.primaryDark} />
          </Pressable>
        ) : null}
      </View>
      {body}
    </View>
  )
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      padding: DESIGN_TOKENS.spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    bare: { gap: DESIGN_TOKENS.spacing.xs },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heading: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '800',
      color: colors.text,
    },
    allBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    allBtnText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.primaryText,
    },
    rank: { marginBottom: DESIGN_TOKENS.spacing.xxs },
    medalsRow: {
      gap: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 2,
      paddingRight: 8,
    },
    peerRow: { marginTop: DESIGN_TOKENS.spacing.xxs },
    empty: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
  })

export default memo(AchievementsSection)
