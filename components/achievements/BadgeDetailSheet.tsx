import { memo, useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Feather } from '@expo/vector-icons'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import type { Badge } from '@/api/achievements'
import BadgeMedal from '@/components/achievements/BadgeMedal'
import ShareBadgeSheet from '@/components/achievements/ShareBadgeSheet'
import { TIER_VISUALS, tierLabel } from '@/components/achievements/badgeVisuals'
import { formatRelativeTime } from '@/utils/relativeTime'
import { translate as i18nT } from '@/i18n'


export interface BadgeDetail {
  badge: Badge
  earned: boolean
  /** PK записи о разблокировке (UserBadge.id). Нужен для share-card — BE ждёт именно его,
   * а не каталожный badge.id. Заполняется только для earned-значков. */
  userBadgeId?: number
  /** ISO-дата получения значка (UserBadge.earnedAt). Только для earned. */
  earnedAt?: string
  progress?: { current: number; threshold: number } | null
}

interface Props {
  visible: boolean
  onClose: () => void
  detail: BadgeDetail | null
  /** Ник владельца для подписи на share-карточке (если известен). */
  ownerName?: string
}

function BadgeDetailSheet({ visible, onClose, detail, ownerName }: Props) {
  const colors = useThemedColors()
  const [shareOpen, setShareOpen] = useState(false)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: colors.background,
          borderTopLeftRadius: DESIGN_TOKENS.radii.xl,
          borderTopRightRadius: DESIGN_TOKENS.radii.xl,
          paddingTop: DESIGN_TOKENS.spacing.md,
          paddingBottom: DESIGN_TOKENS.spacing.xxl,
          paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
        },
        closeBtn: {
          width: DESIGN_TOKENS.touchTarget.minWidth,
          height: DESIGN_TOKENS.touchTarget.minHeight,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.backgroundSecondary,
        },
        center: { alignItems: 'center', gap: DESIGN_TOKENS.spacing.sm },
        name: {
          fontSize: DESIGN_TOKENS.typography.sizes.lg,
          fontWeight: '800',
          color: colors.text,
          textAlign: 'center',
        },
        metaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: DESIGN_TOKENS.spacing.sm,
          flexWrap: 'wrap',
          justifyContent: 'center',
        },
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: colors.backgroundSecondary,
        },
        chipText: {
          fontSize: DESIGN_TOKENS.typography.sizes.xs,
          fontWeight: '700',
          color: colors.text,
        },
        block: {
          marginTop: DESIGN_TOKENS.spacing.lg,
          gap: 6,
        },
        blockLabel: {
          fontSize: DESIGN_TOKENS.typography.sizes.xs,
          fontWeight: '700',
          color: colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        criteria: {
          fontSize: DESIGN_TOKENS.typography.sizes.md,
          color: colors.text,
          lineHeight: 22,
        },
        progressNumbers: {
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        },
        progressCount: {
          fontSize: DESIGN_TOKENS.typography.sizes.md,
          fontWeight: '800',
          color: colors.text,
        },
        progressRemaining: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          color: colors.textMuted,
        },
        track: {
          height: 8,
          borderRadius: 999,
          backgroundColor: colors.backgroundTertiary,
          overflow: 'hidden',
        },
        fill: { height: '100%', borderRadius: 999 },
        earnedRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: DESIGN_TOKENS.spacing.md,
        },
        earnedText: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          fontWeight: '700',
          color: colors.success,
        },
        shareBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginTop: DESIGN_TOKENS.spacing.lg,
          paddingVertical: 12,
          borderRadius: DESIGN_TOKENS.radii.md,
          backgroundColor: colors.primary,
        },
        shareBtnText: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          fontWeight: '800',
          color: colors.textOnPrimary ?? '#fff',
        },
      }),
    [colors],
  )

  if (!detail) return null

  const { badge, earned, userBadgeId, earnedAt, progress } = detail
  const earnedAtMs = earnedAt ? Date.parse(earnedAt) : NaN
  const earnedAtLabel = Number.isFinite(earnedAtMs)
    ? formatRelativeTime(earnedAtMs)
    : ''
  // Share-card требует UserBadge.id заработанной записи (BE 403 на каталожный badge.id).
  // Без него кнопку «Поделиться» не показываем — деградируем, а не шлём неверный id.
  const canShare = earned && Boolean(ownerName) && userBadgeId != null
  const tier = TIER_VISUALS[badge.tier]
  const tl = tierLabel(badge.tier)

  const showProgress = !earned && progress && progress.threshold > 0
  const ratio = showProgress
    ? Math.max(0, Math.min(1, progress.current / progress.threshold))
    : 1
  const remaining = showProgress
    ? Math.max(0, progress.threshold - progress.current)
    : 0

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel={i18nT('achievements:components.achievements.BadgeDetailSheet.zakryt_f1ccd424')}
      >
        <Pressable
          style={styles.sheet}
          onPress={() => {}}
          testID="badge-detail-sheet"
        >
          <View style={styles.header}>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={i18nT('achievements:components.achievements.BadgeDetailSheet.zakryt_f1ccd424')}
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.center}>
            <BadgeMedal badge={badge} size={96} earned={earned} />
            <Text style={styles.name}>{badge.name}</Text>
            <View style={styles.metaRow}>
              {tl ? (
                <View style={styles.chip}>
                  <Feather name="award" size={12} color={tier.ring} />
                  <Text style={styles.chipText}>{tl}</Text>
                </View>
              ) : null}
              <View style={styles.chip}>
                <Feather name="star" size={12} color={colors.primaryDark} />
                <Text style={styles.chipText}>{badge.points} {i18nT('achievements:components.achievements.BadgeDetailSheet.xp_3878de4b')}</Text>
              </View>
            </View>
          </View>

          {badge.description ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>
                {earned ? i18nT('achievements:components.achievements.BadgeDetailSheet.za_chto_poluchen_504e69c3') : i18nT('achievements:components.achievements.BadgeDetailSheet.kak_poluchit_d0b3d9d4')}
              </Text>
              <Text style={styles.criteria}>{badge.description}</Text>
            </View>
          ) : null}

          {showProgress ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>{i18nT('achievements:components.achievements.BadgeDetailSheet.progress_638229b7')}</Text>
              <View style={styles.progressNumbers}>
                <Text style={styles.progressCount}>
                  {progress.current} / {progress.threshold}
                </Text>
                <Text style={styles.progressRemaining}>
                  {i18nT('achievements:components.achievements.BadgeDetailSheet.ostalos_9237468c')}{remaining}
                </Text>
              </View>
              <View style={styles.track}>
                <LinearGradient
                  colors={[tier.highlight, tier.ring]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.fill, { width: `${ratio * 100}%` }]}
                />
              </View>
            </View>
          ) : null}

          {earned ? (
            <View style={styles.earnedRow}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={styles.earnedText}>
                {earnedAtLabel
                  ? i18nT('achievements:components.achievements.BadgeDetailSheet.poluchen_value1_0c966f04', { value1: earnedAtLabel })
                  : i18nT('achievements:components.achievements.BadgeDetailSheet.znachok_poluchen_66bd211f')}
              </Text>
            </View>
          ) : null}

          {canShare ? (
            <Pressable
              style={styles.shareBtn}
              onPress={() => setShareOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={i18nT('achievements:components.achievements.BadgeDetailSheet.podelitsya_dostizheniem_52b86d7a')}
            >
              <Feather name="share-2" size={16} color={colors.textOnPrimary ?? '#fff'} />
              <Text style={styles.shareBtnText}>{i18nT('achievements:components.achievements.BadgeDetailSheet.podelitsya_00be0478')}</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>

      <ShareBadgeSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        context="detail"
        subject={
          canShare && userBadgeId != null
            ? {
                achievementId: userBadgeId,
                slug: badge.slug,
                badge,
                ownerName,
                reason: badge.description,
              }
            : null
        }
      />
    </>
  )
}

export default memo(BadgeDetailSheet)
