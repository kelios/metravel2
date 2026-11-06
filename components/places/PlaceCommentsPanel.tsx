import { useEffect, useMemo, useRef } from 'react'
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'

import { PLACE_COMMENT_MAX_LENGTH } from '@/api/placeComments'
import { getErrorStatus } from '@/api/parsers/apiResponseParser'
import PlaceCommentItem from '@/components/places/PlaceCommentItem'
import { CommentForm } from '@/components/travel/CommentForm'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { usePlaceComments } from '@/hooks/usePlaceComments'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import { confirmAction } from '@/utils/confirmAction'

type Props = { pointId: number; placeTitle: string; onClose: () => void }

export default function PlaceCommentsPanel({ pointId, placeTitle, onClose }: Props) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { width } = useWindowDimensions()
  const wide = width >= 760
  const { owner, authReady, comments, query, post, remove } = usePlaceComments(pointId)
  const status = getErrorStatus(query.error)
  const accessDenied = status === 401 || status === 403 || status === 404
  const { requireAuth } = useRequireAuth({ intent: 'comment', fallbackRedirect: '/places', subject: placeTitle })
  const mounted = useRef(false)
  const confirmingDelete = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const deleteOwnComment = async (commentId: number) => {
    if (confirmingDelete.current || remove.isPending) return
    confirmingDelete.current = true
    try {
      const confirmed = await confirmAction({
        title: t('travel:components.travel.CommentItem.udalit_kommentariy_25a8d8a8'),
        message: t('travel:components.travel.CommentItem.vy_uvereny_chto_hotite_udalit_kommentariy_et_d2432436'),
        confirmText: t('common:action.delete'),
        cancelText: t('common:action.cancel'),
      })
      if (confirmed && mounted.current) remove.mutate({ pointId, owner, commentId })
    } finally {
      confirmingDelete.current = false
    }
  }

  const retryLabel = t('travel:components.travel.CommentsSection.povtorit_0a31dc37')
  const loadError = t('travel:components.travel.CommentsSection.ne_udalos_zagruzit_kommentarii_proverte_soed_f717eb8f')
  const list = (
    <View style={styles.content} testID="place-comments-list">
      {query.isPending && (
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {t('map:components.MapPage.Map.createMapPopupComponent.zagruzka_80ba0ae0')}
        </Text>
      )}
      {query.isError && (accessDenied || !query.isFetchNextPageError) && (
        <View style={styles.feedback}>
          <Text style={styles.error} accessibilityRole="alert">{loadError}</Text>
          <Button label={retryLabel} variant="ghost" loading={query.isRefetching} onPress={() => void query.refetch()} />
        </View>
      )}
      {comments.length === 0 && query.isSuccess && !query.hasNextPage && (
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {t('travel:components.travel.CommentsSection.poka_net_kommentariev_58dc3990')}
        </Text>
      )}
      {!accessDenied && comments.map((comment) => (
        <PlaceCommentItem
          key={comment.id}
          comment={comment}
          onDelete={owner !== null && Number(owner) === comment.user ? (id) => void deleteOwnComment(id) : undefined}
          deleteDisabled={remove.isPending}
          deleting={remove.isPending && remove.variables.commentId === comment.id}
        />
      ))}
      {!accessDenied && query.hasNextPage && (
        <View style={styles.feedback}>
          {query.isFetchNextPageError && <Text style={styles.error} accessibilityRole="alert">{loadError}</Text>}
          <Button
            label={query.isFetchNextPageError ? retryLabel : t('travel:components.travel.CommentsSection.pokazat_esche_kommentarii_009ae890')}
            variant="ghost"
            loading={query.isFetchingNextPage}
            disabled={query.isRefetching}
            onPress={() => void query.fetchNextPage({ cancelRefetch: false })}
          />
        </View>
      )}
    </View>
  )

  const footer = authReady && query.data && !accessDenied ? (
    <View style={styles.footer}>
      {post.isError && post.variables.owner === owner && (
        <Text style={styles.error} accessibilityRole="alert">{t('sharedStatic:placeComments.sendError')}</Text>
      )}
      {post.isSuccess && post.variables.owner === owner && post.data.heldForModeration && (
        <Text style={styles.notice} accessibilityLiveRegion="polite">{t('sharedStatic:placeComments.pendingModeration')}</Text>
      )}
      {remove.isError && remove.variables.owner === owner && (
        <Text style={styles.error} accessibilityRole="alert">
          {t('shared:hooks.comments.commentMutations.ne_udalos_udalit_kommentariy_4853133a')}
        </Text>
      )}
      {owner === null ? (
        <Button
          label={t('travel:components.travel.CommentsSection.voyti_chtoby_ostavit_kommentariy_577d7abb')}
          onPress={() => { if (!requireAuth()) onClose() }}
          variant="outline"
          fullWidth
        />
      ) : (
        <CommentForm
          key={owner}
          maxLength={PLACE_COMMENT_MAX_LENGTH}
          isSubmitting={post.isPending}
          onSubmit={(text) => post.mutateAsync({ pointId, owner, text })}
        />
      )}
    </View>
  ) : null

  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={t('sharedStatic:placeComments.title', { place: placeTitle })}
      placement={wide ? 'center' : 'bottom'}
      panelStyle={styles.panel}
      keyboardAware
      footer={footer}
    >
      {wide ? list : (
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">{list}</ScrollView>
      )}
    </BottomSheet>
  )
}

const createStyles = (colors: ThemedColors) => StyleSheet.create({
  panel: { maxHeight: '88%' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { minHeight: 72, paddingBottom: DESIGN_TOKENS.spacing.sm },
  feedback: { gap: DESIGN_TOKENS.spacing.xs, paddingTop: DESIGN_TOKENS.spacing.sm },
  footer: { gap: DESIGN_TOKENS.spacing.xs, paddingTop: DESIGN_TOKENS.spacing.sm },
  status: { color: colors.textMuted, paddingVertical: DESIGN_TOKENS.spacing.md },
  notice: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
})
