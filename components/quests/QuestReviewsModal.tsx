import { memo, useMemo } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import StarRating from '@/components/ui/StarRating'
import UserAvatar from '@/components/layout/UserAvatar'
import { useQuestReviews } from '@/hooks/useQuestsApi'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { QuestReview } from '@/api/quests'
import { formatDate, translate as i18nT } from '@/i18n'


type Props = {
  questId: string
  visible: boolean
  onClose: () => void
}

const formatReviewDate = (iso: string | null): string | null => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })
}

function ReviewItem({ review, styles }: { review: QuestReview; styles: ReturnType<typeof createStyles> }) {
  const dateText = formatReviewDate(review.createdAt)
  return (
    <View style={styles.reviewItem} testID={`quest-review-item-${review.id}`}>
      <View style={styles.reviewHeader}>
        <UserAvatar uri={review.authorAvatar} size="md" />
        <View style={styles.reviewHeaderText}>
          <Text style={styles.reviewAuthor} numberOfLines={1}>
            {review.authorName || i18nT('quests:components.quests.QuestReviewsModal.defaultAuthorName')}
          </Text>
          {dateText ? <Text style={styles.reviewDate}>{dateText}</Text> : null}
        </View>
        <StarRating rating={review.rating} size="small" showValue={false} showCount={false} />
      </View>

      {review.liked ? (
        <View style={styles.reviewBlock}>
          <Text style={styles.reviewBlockLabel}>{i18nT('quests:components.quests.QuestReviewsModal.ponravilos_dc466c74')}</Text>
          <Text style={styles.reviewBlockText}>{review.liked}</Text>
        </View>
      ) : null}

      {review.disliked ? (
        <View style={styles.reviewBlock}>
          <Text style={styles.reviewBlockLabel}>{i18nT('quests:components.quests.QuestReviewsModal.chto_uluchshit_74a4d291')}</Text>
          <Text style={styles.reviewBlockText}>{review.disliked}</Text>
        </View>
      ) : null}
    </View>
  )
}

function QuestReviewsModal({ questId, visible, onClose }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { data, isLoading, isError, refetch } = useQuestReviews(questId, visible)

  const reviews = data ?? []

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={i18nT('quests:components.quests.QuestReviewsModal.zakryt_otzyvy_3d58b380')}>
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
          testID="quest-reviews-modal"
        >
          <View style={styles.header}>
            <Text style={styles.title}>{i18nT('quests:components.quests.QuestReviewsModal.otzyvy_o_kveste_0e87f487')}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel={i18nT('quests:components.quests.QuestReviewsModal.zakryt_bc1e31bc')}
              testID="quest-reviews-close"
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.stateBox} testID="quest-reviews-loading">
              <ActivityIndicator color={colors.primaryDark} />
            </View>
          ) : isError ? (
            <View style={styles.stateBox} testID="quest-reviews-error">
              <Text style={styles.stateText}>{i18nT('quests:components.quests.QuestReviewsModal.ne_udalos_zagruzit_otzyvy_651269a8')}</Text>
              <Pressable
                onPress={() => refetch()}
                style={styles.retryButton}
                accessibilityRole="button"
                accessibilityLabel={i18nT('quests:components.quests.QuestReviewsModal.povtorit_5faeeb55')}
              >
                <Text style={styles.retryText}>{i18nT('quests:components.quests.QuestReviewsModal.povtorit_5faeeb55')}</Text>
              </Pressable>
            </View>
          ) : reviews.length === 0 ? (
            <View style={styles.stateBox} testID="quest-reviews-empty">
              <Text style={styles.stateText}>{i18nT('quests:components.quests.QuestReviewsModal.poka_net_otzyvov_5b24df62')}</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {reviews.map((review) => (
                <ReviewItem key={review.id} review={review} styles={styles} />
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    sheet: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '85%',
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 8,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    list: {
      width: '100%',
    },
    listContent: {
      gap: 14,
      paddingBottom: 12,
    },
    reviewItem: {
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    reviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    reviewHeaderText: {
      flex: 1,
      minWidth: 0,
    },
    reviewAuthor: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    reviewDate: {
      fontSize: 12,
      color: colors.textMuted,
    },
    reviewBlock: {
      gap: 3,
    },
    reviewBlockLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
    },
    reviewBlockText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
    stateBox: {
      paddingVertical: 36,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    stateText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    retryButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.primary,
    },
    retryText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
  })

export default memo(QuestReviewsModal)
