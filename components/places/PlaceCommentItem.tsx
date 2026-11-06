import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { PlaceComment } from '@/api/placeComments'
import ContentSafetyActions from '@/components/safety/ContentSafetyActions'
import HiddenContentGate from '@/components/safety/HiddenContentGate'
import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import { formatDate, formatInteger } from '@/i18n/format'
import { makeContentRef } from '@/types/contentSafety'

type Props = {
  comment: PlaceComment
  onDelete?: (commentId: number) => void
  deleting?: boolean
  deleteDisabled?: boolean
}

export default function PlaceCommentItem({ comment, onDelete, deleting, deleteDisabled }: Props) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const contentRef = useMemo(() => makeContentRef('place_comment', comment.id, comment.user), [comment.id, comment.user])
  const date = Date.parse(comment.created_at)
  const author = comment.user_name.trim()
    || t('travel:components.travel.CommentItem.userFallback', { value1: formatInteger(comment.user) })

  return (
    <HiddenContentGate contentRef={contentRef}>
      <View style={styles.item} testID={`place-comment-${comment.id}`}>
        <View style={styles.header}>
          <View style={styles.authorBlock}>
            <Text style={styles.author}>{author}</Text>
            {Number.isFinite(date) && (
              <Text style={styles.date}>{formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            )}
          </View>
          {onDelete ? (
            <Button
              label={t('travel:components.travel.CommentItem.udalit_kommentariy_25a8d8a8')}
              variant="ghost"
              iconOnly
              icon={<Feather name="trash-2" size={18} color={colors.danger} />}
              disabled={deleteDisabled}
              loading={deleting}
              onPress={() => onDelete(comment.id)}
              testID={`place-comment-delete-${comment.id}`}
            />
          ) : (
            <ContentSafetyActions contentRef={contentRef} authorName={author} testIDPrefix={`place-comment-safety-${comment.id}`} />
          )}
        </View>
        <Text style={styles.text}>{comment.text}</Text>
      </View>
    </HiddenContentGate>
  )
}

const createStyles = (colors: ThemedColors) => StyleSheet.create({
  item: {
    gap: DESIGN_TOKENS.spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: DESIGN_TOKENS.spacing.sm },
  authorBlock: { flex: 1, minWidth: 0 },
  author: { color: colors.text, fontWeight: '700' },
  date: { color: colors.textMuted, fontSize: 12 },
  text: { color: colors.text, fontSize: 14, lineHeight: 21 },
})
