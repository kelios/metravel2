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

export interface BadgeDetail {
  badge: Badge
  earned: boolean
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
          width: 36,
          height: 36,
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

  const { badge, earned, progress } = detail
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
        accessibilityLabel="Закрыть"
      >
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
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
                <Feather name="star" size={12} color={colors.primary} />
                <Text style={styles.chipText}>{badge.points} XP</Text>
              </View>
            </View>
          </View>

          {badge.description ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>
                {earned ? 'За что получен' : 'Как получить'}
              </Text>
              <Text style={styles.criteria}>{badge.description}</Text>
            </View>
          ) : null}

          {showProgress ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Прогресс</Text>
              <View style={styles.progressNumbers}>
                <Text style={styles.progressCount}>
                  {progress.current} / {progress.threshold}
                </Text>
                <Text style={styles.progressRemaining}>
                  осталось {remaining}
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
              <Text style={styles.earnedText}>Значок получен</Text>
            </View>
          ) : null}

          {earned && ownerName ? (
            <Pressable
              style={styles.shareBtn}
              onPress={() => setShareOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Поделиться достижением"
            >
              <Feather name="share-2" size={16} color={colors.textOnPrimary ?? '#fff'} />
              <Text style={styles.shareBtnText}>Поделиться</Text>
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
          earned
            ? {
                achievementId: badge.id,
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
