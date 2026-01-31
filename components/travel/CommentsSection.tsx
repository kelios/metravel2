import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import {
  useMainThread,
  useComments,
  useCreateComment,
  useUpdateComment,
  useReplyToComment,
} from '../../hooks/useComments';
import { useAuth } from '../../context/AuthContext';
import type { TravelComment } from '../../types/comments';

interface CommentsSectionProps {
  travelId: number;
}

export function CommentsSection({ travelId }: CommentsSectionProps) {
  const { isAuthenticated, userId } = useAuth();
  const [replyTo, setReplyTo] = useState<TravelComment | null>(null);
  const [editComment, setEditComment] = useState<TravelComment | null>(null);

  const {
    data: mainThread,
    isLoading: isLoadingThread,
    error: threadError,
  } = useMainThread(travelId);

  const {
    data: comments = [],
    isLoading: isLoadingComments,
    error: commentsError,
    refetch,
  } = useComments(mainThread?.id || 0);

  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const replyToComment = useReplyToComment();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const handleSubmitComment = useCallback(
    (text: string) => {
      if (editComment) {
        updateComment.mutate(
          { commentId: editComment.id, data: { text } },
          {
            onSuccess: () => {
              setEditComment(null);
            },
          }
        );
      } else if (replyTo) {
        replyToComment.mutate(
          { commentId: replyTo.id, data: { text } },
          {
            onSuccess: () => {
              setReplyTo(null);
            },
          }
        );
      } else {
        createComment.mutate(
          { travel_id: travelId, text },
          {
            onSuccess: () => {
              // Refetch comments after creating a new one
              refetch();
            },
          }
        );
      }
    },
    [travelId, replyTo, editComment, createComment, updateComment, replyToComment, refetch]
  );

  const handleReply = useCallback((comment: TravelComment) => {
    setReplyTo(comment);
    setEditComment(null);
  }, []);

  const handleEdit = useCallback((comment: TravelComment) => {
    setEditComment(comment);
    setReplyTo(null);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditComment(null);
  }, []);

  const organizeComments = (comments: TravelComment[]) => {
    const topLevel: TravelComment[] = [];
    const replies: { [key: number]: TravelComment[] } = {};

    comments.forEach((comment) => {
      if (comment.sub_thread) {
        if (!replies[comment.sub_thread]) {
          replies[comment.sub_thread] = [];
        }
        replies[comment.sub_thread].push(comment);
      } else {
        topLevel.push(comment);
      }
    });

    return { topLevel, replies };
  };

  const { topLevel, replies } = organizeComments(comments);

  const isLoading = isLoadingThread || isLoadingComments;
  const error = threadError || commentsError;
  const isSubmitting =
    createComment.isPending || updateComment.isPending || replyToComment.isPending;

  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={DESIGN_TOKENS.colors.primary} />
      </View>
    );
  }

  // Show error but still allow creating comments
  const hasError = !!error;
  if (hasError) {
    console.error('Comments error:', { threadError, commentsError, mainThread, travelId });
  }

  return (
    <View style={styles.container} nativeID="comments">
      <View style={styles.header}>
        <Feather name="message-circle" size={24} color={DESIGN_TOKENS.colors.text} />
        <Text style={styles.title}>
          Комментарии {comments.length > 0 && `(${comments.length})`}
        </Text>
      </View>

      {hasError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>⚠️ Не удалось загрузить комментарии</Text>
          <Text style={styles.errorBannerSubtext}>
            {threadError?.message || commentsError?.message || 'Проверьте подключение'}
          </Text>
        </View>
      )}

      {isAuthenticated && (
        <CommentForm
          onSubmit={handleSubmitComment}
          isSubmitting={isSubmitting}
          replyTo={replyTo}
          onCancelReply={handleCancelReply}
          editComment={editComment}
          onCancelEdit={handleCancelEdit}
          autoFocus={!!replyTo || !!editComment}
        />
      )}

      {!isAuthenticated && (
        <View style={styles.loginPrompt}>
          <Text style={styles.loginText}>Войдите, чтобы оставить комментарий</Text>
        </View>
      )}

      <ScrollView
        style={styles.commentsList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {hasError && topLevel.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="message-circle" size={48} color={DESIGN_TOKENS.colors.disabled} />
            <Text style={styles.emptyText}>Комментарии недоступны</Text>
            <Text style={styles.emptySubtext}>Попробуйте обновить страницу</Text>
          </View>
        ) : topLevel.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="message-circle" size={48} color={DESIGN_TOKENS.colors.disabled} />
            <Text style={styles.emptyText}>Пока нет комментариев</Text>
            <Text style={styles.emptySubtext}>Будьте первым, кто оставит комментарий!</Text>
          </View>
        ) : (
          topLevel.map((comment) => (
            <View key={comment.id}>
              <CommentItem
                comment={comment}
                onReply={isAuthenticated ? handleReply : undefined}
                onEdit={isAuthenticated ? handleEdit : undefined}
                level={0}
              />
              {replies[comment.id]?.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  onReply={isAuthenticated ? handleReply : undefined}
                  onEdit={isAuthenticated ? handleEdit : undefined}
                  level={1}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    padding: DESIGN_TOKENS.spacing.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: DESIGN_TOKENS.typography.weights.bold,
    color: DESIGN_TOKENS.colors.text,
  },
  loginPrompt: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.sm,
    padding: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
    alignItems: 'center',
  },
  loginText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md - 1,
    color: DESIGN_TOKENS.colors.textMuted,
  },
  commentsList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: DESIGN_TOKENS.spacing.xxl,
  },
  emptyText: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg - 2,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold,
    color: DESIGN_TOKENS.colors.textMuted,
    marginTop: DESIGN_TOKENS.spacing.md,
  },
  emptySubtext: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: DESIGN_TOKENS.colors.textSubtle,
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
  errorText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: DESIGN_TOKENS.colors.textMuted,
    marginTop: DESIGN_TOKENS.spacing.md,
  },
  errorSubtext: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: DESIGN_TOKENS.colors.textSubtle,
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
  errorBanner: {
    backgroundColor: DESIGN_TOKENS.colors.warningSoft,
    borderRadius: DESIGN_TOKENS.radii.sm - 4,
    padding: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: DESIGN_TOKENS.colors.warning,
  },
  errorBannerText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold,
    color: DESIGN_TOKENS.colors.warningDark,
    marginBottom: DESIGN_TOKENS.spacing.xxs,
  },
  errorBannerSubtext: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: DESIGN_TOKENS.colors.warningDark,
  },
});
