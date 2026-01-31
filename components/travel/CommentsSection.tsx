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

const Lucide = Platform.OS === 'web' ? require('lucide-react') : require('lucide-react-native');
const MessageCircle = (Lucide as any).MessageCircle as any;
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
        <ActivityIndicator size="large" color="#007AFF" />
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
        <MessageCircle size={24} color="#000" />
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
            <MessageCircle size={48} color="#ccc" />
            <Text style={styles.emptyText}>Комментарии недоступны</Text>
            <Text style={styles.emptySubtext}>Попробуйте обновить страницу</Text>
          </View>
        ) : topLevel.length === 0 ? (
          <View style={styles.emptyState}>
            <MessageCircle size={48} color="#ccc" />
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
    backgroundColor: '#f8f9fa',
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  loginPrompt: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  loginText: {
    fontSize: 15,
    color: '#666',
  },
  commentsList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  errorBanner: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  errorBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  errorBannerSubtext: {
    fontSize: 12,
    color: '#856404',
  },
});
