import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import type { TravelComment } from '../../types/comments';
import { useAuth } from '../../context/AuthContext';
import { useLikeComment, useUnlikeComment, useDeleteComment } from '../../hooks/useComments';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { ru } from 'date-fns/locale/ru';

interface CommentItemProps {
  comment: TravelComment;
  onReply?: (comment: TravelComment) => void;
  onEdit?: (comment: TravelComment) => void;
  level?: number;
}

export function CommentItem({ comment, onReply, onEdit, level = 0 }: CommentItemProps) {
  const { userId, isSuperuser, isAuthenticated } = useAuth();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showActions, setShowActions] = useState(false);

  const likeComment = useLikeComment();
  const unlikeComment = useUnlikeComment();
  const deleteComment = useDeleteComment();

  const isAuthor = !!userId && Number(userId) === comment.user;
  const canDelete = isAuthor || isSuperuser;
  const canEdit = isAuthor;
  const isLiked = !!comment.is_liked;

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

  const confirmDelete = (onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm('Вы уверены, что хотите удалить комментарий?')
        : true;
      if (ok) onConfirm();
      return;
    }

    Alert.alert('Удалить комментарий?', 'Вы уверены, что хотите удалить комментарий?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: onConfirm },
    ]);
  };

  const handleDelete = () => {
    confirmDelete(() => {
      deleteComment.mutate(comment.id);
    });
  };

  const formattedDate = (() => {
    if (!comment.created_at) return '';
    const date = new Date(comment.created_at);
    if (Number.isNaN(date.getTime())) return '';
    try {
      return formatDistanceToNow(date, { addSuffix: true, locale: ru });
    } catch {
      return '';
    }
  })();

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
            testID="comment-actions-trigger"
          >
            <Feather name="more-vertical" size={20} color={colors.textMuted} />
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
              testID="comment-actions-edit"
            >
              <Feather name="edit-2" size={18} color={colors.primary} />
            </Pressable>
          )}
          {canDelete && (
            <Pressable
              onPress={handleDelete}
              style={styles.actionButton}
              disabled={deleteComment.isPending}
              accessibilityLabel="Удалить комментарий"
              testID="comment-actions-delete"
            >
              {deleteComment.isPending ? (
                <ActivityIndicator
                  testID="activity-indicator"
                  size="small"
                  color={colors.danger}
                />
              ) : (
                <Feather name="trash-2" size={18} color={colors.danger} />
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

        {!isAuthenticated && comment.likes_count > 0 && (
          <View style={styles.footerButton}>
            <Feather name="heart" size={16} color={colors.textMuted} />
            <Text style={styles.footerText}>{comment.likes_count}</Text>
          </View>
        )}

        {isAuthenticated && onReply && level < 2 && (
          <Pressable
            onPress={() => onReply(comment)}
            style={styles.footerButton}
            accessibilityLabel="Ответить на комментарий"
            testID="comment-reply"
          >
            <Feather name="message-circle" size={16} color={colors.textMuted} />
            <Text style={styles.footerText}>Ответить</Text>
          </Pressable>
        )}

      </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create<Record<string, any>>({
  wrapper: {
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: Platform.select({ default: DESIGN_TOKENS.spacing.md, web: 18 }),
    marginBottom: DESIGN_TOKENS.spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  nested: {
    marginLeft: Platform.select({ default: 40, web: 48 }),
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
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: DESIGN_TOKENS.spacing.sm,
  },
  avatarText: {
    color: colors.primary,
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
