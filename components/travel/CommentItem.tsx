import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, Image } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { TravelComment } from '../../types/comments';
import { useAuth } from '../../context/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useLikeComment, useUnlikeComment, useDeleteComment } from '../../hooks/useComments';
import { formatRelativeTime } from '@/utils/relativeTime';
import { translate as i18nT } from '@/i18n'


interface CommentItemProps {
  comment: TravelComment;
  onReply?: (comment: TravelComment) => void;
  onEdit?: (comment: TravelComment) => void;
  level?: number;
}

function CommentItemComponent({ comment, onReply, onEdit, level = 0 }: CommentItemProps) {
  const { userId, isSuperuser, isAuthenticated } = useAuth();
  const { requireAuth } = useRequireAuth({ intent: 'comment' });
  const colors = useThemedColors();
  const { isMobile } = useResponsive();
  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile]);
  const [showActions, setShowActions] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const likeComment = useLikeComment();
  const unlikeComment = useUnlikeComment();
  const deleteComment = useDeleteComment();

  // Оптимистичный комментарий ещё не сохранён на сервере (см. createOptimisticComment):
  // user === 0 до рефетча. Мутации edit/delete/reply по его временному id привели бы к 404.
  const isOptimistic = comment.user === 0;
  const isAuthor = !isOptimistic && !!userId && Number(userId) === comment.user;
  const canDelete = (isAuthor || isSuperuser) && !isOptimistic;
  const canEdit = isAuthor;
  const isLiked = !!comment.is_liked;
  const showsAdminDeleteLabel = isSuperuser && !isAuthor;

  const handleLikeToggle = () => {
    // Предотвращаем клик во время выполнения мутации
    if (likeComment.isPending || unlikeComment.isPending) {
      return;
    }

    if (isLiked) {
      unlikeComment.mutate(comment.id);
    } else {
      likeComment.mutate(comment.id);
    }
  };

  const handleDelete = () => {
    setConfirmVisible(true);
  };

  const handleConfirmDelete = () => {
    deleteComment.mutate(comment.id);
    setConfirmVisible(false);
  };

  const formattedDate = (() => {
    if (!comment.created_at) return '';
    const timestamp = new Date(comment.created_at).getTime();
    if (Number.isNaN(timestamp)) return '';
    return formatRelativeTime(timestamp);
  })();

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, level > 0 && styles.nested]} testID="comment-item">
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            {comment.user_avatar && !avatarError ? (
              <Image
                source={{ uri: optimizeImageUrl(comment.user_avatar, { width: 72, height: 72, quality: 70, format: 'auto', fit: 'cover' }) ?? comment.user_avatar }}
                style={styles.avatarImage}
                onError={() => setAvatarError(true)}
                accessibilityIgnoresInvertColors
                testID="comment-avatar-image"
              />
            ) : (
              <Text style={styles.avatarText}>
                {comment.user_name?.[0]?.toUpperCase() || 'U'}
              </Text>
            )}
          </View>
          <View>
            <Text style={styles.userName}>
              {comment.user_name || i18nT('travel:components.travel.CommentItem.userFallback', { value1: comment.user })}
            </Text>
            <Text style={styles.date}>{formattedDate}</Text>
          </View>
        </View>
        {(canEdit || canDelete) && (
          <Pressable
            onPress={() => setShowActions(!showActions)}
            style={styles.moreButton}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={i18nT('travel:components.travel.CommentItem.deystviya_s_kommentariem_c7fbcb60')}
            accessibilityState={{ expanded: showActions }}
            testID="comment-actions-trigger"
          >
            <Feather name={showActions ? 'x' : 'more-vertical'} size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <Text style={styles.text}>{comment.text}</Text>

      {showActions && (canEdit || canDelete) && (
        <View style={styles.actions}>
          {canEdit && onEdit && (
            <Pressable
              onPress={() => {
                onEdit(comment);
                setShowActions(false);
              }}
              style={styles.actionButton}
              accessibilityLabel={i18nT('travel:components.travel.CommentItem.redaktirovat_kommentariy_4777db64')}
              testID="comment-actions-edit"
            >
              <Feather name="edit-2" size={18} color={colors.primaryDark} />
              <Text style={styles.actionLabel}>{i18nT('travel:components.travel.CommentItem.izmenit_3b5da3b2')}</Text>
            </Pressable>
          )}
          {canDelete && (
            <Pressable
              onPress={handleDelete}
              style={styles.actionButton}
              disabled={deleteComment.isPending}
              accessibilityLabel={
                showsAdminDeleteLabel ? i18nT('travel:components.travel.CommentItem.udalit_kommentariy_admin_d55d0a7c') : i18nT('travel:components.travel.CommentItem.udalit_kommentariy_25a8d8a8')
              }
              testID="comment-actions-delete"
            >
              {deleteComment.isPending ? (
                <ActivityIndicator
                  testID="activity-indicator"
                  size="small"
                  color={colors.danger}
                />
              ) : (
                <>
                  <Feather name="trash-2" size={18} color={colors.danger} />
                  <Text style={showsAdminDeleteLabel ? styles.deleteAdminLabel : styles.deleteLabel}>
                    {showsAdminDeleteLabel ? i18nT('travel:components.travel.CommentItem.udalit_admin_b33b3c72') : i18nT('travel:components.travel.CommentItem.udalit_15129e08')}
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.footer}>
        {isAuthenticated && (
          <Pressable
            onPress={handleLikeToggle}
            style={styles.footerButton}
            hitSlop={8}
            disabled={likeComment.isPending || unlikeComment.isPending}
            accessibilityLabel={isLiked ? i18nT('travel:components.travel.CommentItem.ubrat_layk_8b9a9e57') : i18nT('travel:components.travel.CommentItem.postavit_layk_5d9b14ea')}
            testID="comment-like"
          >
            <Feather
              name="heart"
              size={16}
              color={isLiked ? colors.danger : colors.textMuted}
            />
            {comment.likes_count > 0 && (
              <Text style={[styles.footerText, isLiked && styles.likedText]}>
                {comment.likes_count}
              </Text>
            )}
          </Pressable>
        )}

        {!isAuthenticated && (
          <Pressable
            onPress={requireAuth}
            style={styles.footerButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={i18nT('travel:components.travel.CommentItem.voydite_chtoby_otsenit_kommentariy_84861e6c')}
          >
            <Feather name="heart" size={16} color={colors.textMuted} />
            {comment.likes_count > 0 && (
              <Text style={styles.footerText}>{comment.likes_count}</Text>
            )}
          </Pressable>
        )}

        {isAuthenticated && onReply && level < 2 && !isOptimistic && (
          <Pressable
            onPress={() => onReply(comment)}
            style={styles.footerButton}
            hitSlop={8}
            accessibilityLabel={i18nT('travel:components.travel.CommentItem.otvetit_na_kommentariy_cff0c125')}
            testID="comment-reply"
          >
            <Feather name="message-circle" size={16} color={colors.textMuted} />
            <Text style={styles.footerText}>{i18nT('travel:components.travel.CommentItem.otvetit_5310e439')}</Text>
          </Pressable>
        )}

      </View>
      </View>

      <ConfirmDialog
        visible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        onConfirm={handleConfirmDelete}
        title={i18nT('travel:components.travel.CommentItem.udalit_kommentariy_a5d75f50')}
        message={i18nT('travel:components.travel.CommentItem.vy_uvereny_chto_hotite_udalit_kommentariy_et_d2432436')}
        confirmText={i18nT('travel:components.travel.CommentItem.udalit_15129e08')}
        cancelText={i18nT('travel:components.travel.CommentItem.otmena_6a66c8f0')}
        confirmTestID="comment-delete-confirm"
        cancelTestID="comment-delete-cancel"
      />
    </View>
  );
}

export const CommentItem = React.memo(CommentItemComponent);

const createStyles = (colors: ReturnType<typeof useThemedColors>, isMobile: boolean) => StyleSheet.create<Record<string, any>>({
  wrapper: {
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: isMobile ? DESIGN_TOKENS.spacing.md : 18,
    marginBottom: DESIGN_TOKENS.spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  nested: {
    marginLeft: isMobile ? 40 : 48,
    backgroundColor: colors.backgroundSecondary,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryAlpha40,
    borderColor: colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: DESIGN_TOKENS.spacing.sm,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: DESIGN_TOKENS.typography.weights.bold,
  },
  userName: {
    fontSize: 14,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold,
    color: colors.text,
    marginBottom: 1,
    letterSpacing: -0.1,
  },
  date: {
    fontSize: 12,
    color: colors.textMuted,
  },
  moreButton: {
    padding: DESIGN_TOKENS.spacing.xxs,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: DESIGN_TOKENS.radii.sm,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
      } as any,
    }),
  },
  text: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.sm,
    paddingTop: DESIGN_TOKENS.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      } as any,
    }),
  },
  actionLabel: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold,
  },
  deleteLabel: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold,
  },
  deleteAdminLabel: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold,
  },
  footer: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.md,
    paddingTop: DESIGN_TOKENS.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: Platform.select({ default: 44, android: 48 }),
    paddingVertical: 4,
    paddingHorizontal: 2,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'opacity 0.15s ease',
      } as any,
    }),
  },
  footerText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: DESIGN_TOKENS.typography.weights.medium,
  },
  likedText: {
    color: colors.danger,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold,
  },
});
