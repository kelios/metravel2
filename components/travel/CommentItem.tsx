import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { TravelComment } from '../../types/comments';
import { useAuth } from '../../context/AuthContext';
import { useLikeComment, useUnlikeComment, useDeleteComment } from '../../hooks/useComments';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface CommentItemProps {
  comment: TravelComment;
  onReply?: (comment: TravelComment) => void;
  onEdit?: (comment: TravelComment) => void;
  level?: number;
}

export function CommentItem({ comment, onReply, onEdit, level = 0 }: CommentItemProps) {
  const { userId, isSuperuser, isAuthenticated } = useAuth();
  const [showActions, setShowActions] = useState(false);
  const likeComment = useLikeComment();
  const unlikeComment = useUnlikeComment();
  const deleteComment = useDeleteComment();

  const isAuthor = userId && Number(userId) === comment.user;
  const canDelete = isAuthor || isSuperuser;
  const canEdit = isAuthor;
  const isLiked = comment.is_liked;

  const handleLikeToggle = () => {
    console.log('Like toggle:', { commentId: comment.id, isLiked, likes_count: comment.likes_count });
    if (isLiked) {
      console.log('Unliking comment:', comment.id);
      unlikeComment.mutate(comment.id);
    } else {
      console.log('Liking comment:', comment.id);
      likeComment.mutate(comment.id);
    }
  };

  const handleDelete = () => {
    if (confirm('Вы уверены, что хотите удалить комментарий?')) {
      deleteComment.mutate(comment.id);
    }
  };

  const formattedDate = comment.created_at
    ? formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ru })
    : '';

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, level > 0 && styles.nested]} testID="comment-item">
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {comment.user_name?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View>
            <Text style={styles.userName}>
              {comment.user_name || `Пользователь #${comment.user}`}
            </Text>
            <Text style={styles.date}>{formattedDate}</Text>
          </View>
        </View>
        {(canEdit || canDelete) && (
          <Pressable
            onPress={() => setShowActions(!showActions)}
            style={styles.moreButton}
            accessibilityLabel="Действия с комментарием"
          >
            <Feather name="more-vertical" size={20} color={DESIGN_TOKENS.colors.textMuted} />
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
              accessibilityLabel="Редактировать комментарий"
            >
              <Feather name="edit-2" size={16} color={DESIGN_TOKENS.colors.primary} />
              <Text style={styles.actionText}>Редактировать</Text>
            </Pressable>
          )}
          {canDelete && (
            <Pressable
              onPress={handleDelete}
              style={styles.actionButton}
              disabled={deleteComment.isPending}
              accessibilityLabel="Удалить комментарий"
            >
              {deleteComment.isPending ? (
                <ActivityIndicator size="small" color={DESIGN_TOKENS.colors.danger} />
              ) : (
                <>
                  <Feather name="trash-2" size={16} color={DESIGN_TOKENS.colors.danger} />
                  <Text style={[styles.actionText, styles.deleteText]}>
                    {isSuperuser && !isAuthor ? 'Удалить (Админ)' : 'Удалить'}
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
            disabled={likeComment.isPending || unlikeComment.isPending}
            accessibilityLabel={isLiked ? 'Убрать лайк' : 'Поставить лайк'}
          >
            <Feather
              name="heart"
              size={18}
              color={isLiked ? DESIGN_TOKENS.colors.danger : DESIGN_TOKENS.colors.textMuted}
            />
            {comment.likes_count > 0 && (
              <Text style={[styles.footerText, isLiked && styles.likedText]}>
                {comment.likes_count}
              </Text>
            )}
          </Pressable>
        )}

        {!isAuthenticated && comment.likes_count > 0 && (
          <View style={styles.footerButton}>
            <Feather name="heart" size={18} color={DESIGN_TOKENS.colors.textMuted} />
            <Text style={styles.footerText}>{comment.likes_count}</Text>
          </View>
        )}

        {isAuthenticated && onReply && level < 2 && (
          <Pressable
            onPress={() => onReply(comment)}
            style={styles.footerButton}
            accessibilityLabel="Ответить на комментарий"
          >
            <Feather name="message-circle" size={18} color={DESIGN_TOKENS.colors.textMuted} />
            <Text style={styles.footerText}>Ответить</Text>
          </Pressable>
        )}
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  threadLine: {
    position: 'absolute',
    left: 32,
    top: 48,
    bottom: DESIGN_TOKENS.spacing.sm,
    width: 2,
    backgroundColor: DESIGN_TOKENS.colors.borderLight,
  },
  container: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.sm,
    padding: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.sm,
    ...(Platform.OS === 'web' ? {
      boxShadow: DESIGN_TOKENS.shadows.light,
    } : DESIGN_TOKENS.shadowsNative.light),
  },
  nested: {
    marginLeft: 48,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    borderLeftWidth: 3,
    borderLeftColor: DESIGN_TOKENS.colors.primary,
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
    width: 40,
    height: 40,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: DESIGN_TOKENS.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: DESIGN_TOKENS.spacing.sm,
  },
  avatarText: {
    color: DESIGN_TOKENS.colors.textOnPrimary,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold,
  },
  userName: {
    fontSize: DESIGN_TOKENS.typography.sizes.md - 1,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold,
    color: DESIGN_TOKENS.colors.text,
    marginBottom: 2,
  },
  date: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm - 1,
    color: DESIGN_TOKENS.colors.textMuted,
  },
  moreButton: {
    padding: DESIGN_TOKENS.spacing.xxs,
  },
  text: {
    fontSize: DESIGN_TOKENS.typography.sizes.md - 1,
    lineHeight: 22,
    color: DESIGN_TOKENS.colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.sm,
    paddingTop: DESIGN_TOKENS.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: DESIGN_TOKENS.colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: 6,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
  },
  actionText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: DESIGN_TOKENS.colors.primary,
    fontWeight: DESIGN_TOKENS.typography.weights.medium,
  },
  deleteText: {
    color: DESIGN_TOKENS.colors.danger,
  },
  footer: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.md,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: DESIGN_TOKENS.spacing.xxs,
  },
  footerText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: DESIGN_TOKENS.colors.textMuted,
  },
  likedText: {
    color: DESIGN_TOKENS.colors.danger,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold,
  },
});
