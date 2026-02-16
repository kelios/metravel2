import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { CommentsSkeleton } from '@/components/travel/TravelDetailSkeletons';
import { sendAnalyticsEvent } from '@/utils/analytics';
import { devWarn } from '@/utils/logger';
import { usePathname, useRouter } from 'expo-router';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import {
  useMainThread,
  useTravelComments,
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
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [replyTo, setReplyTo] = useState<TravelComment | null>(null);
  const [editComment, setEditComment] = useState<TravelComment | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<number>>(new Set());
  const didWarnAllSubThread = useRef(false);

  const {
    data: mainThread,
    isLoading: isLoadingThread,
    error: threadError,
    refetch: refetchThread,
  } = useMainThread(travelId);

  const {
    data: comments = [],
    isLoading: isLoadingComments,
    error: commentsError,
    refetch: refetchComments,
  } = useTravelComments(travelId, mainThread?.id);


  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const replyToComment = useReplyToComment();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const tasks: Promise<unknown>[] = [refetchThread(), refetchComments()];
      await Promise.allSettled(tasks);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchComments, refetchThread]);

  const { topLevel, replies, allComments, subThreadToParent } = useMemo(() => {
    const _topLevel: TravelComment[] = [];
    const _replies: { [key: number]: TravelComment[] } = {};
    const _allComments: { [key: number]: TravelComment } = {};

    // Index all comments by ID
    comments.forEach((comment) => {
      _allComments[comment.id] = comment;
    });

    // Build a map: subThreadId → parentCommentId.
    // The backend sub-thread model: if comment A has sub_thread=63,
    // then all comments with thread=63 are replies to comment A.
    const subThreadToParent: { [threadId: number]: number } = {};
    comments.forEach((comment) => {
      const st = typeof comment.sub_thread === 'string' ? Number(comment.sub_thread) : comment.sub_thread;
      if (typeof st === 'number' && !Number.isNaN(st) && st > 0) {
        subThreadToParent[st] = comment.id;
      }
    });

    comments.forEach((comment) => {
      // A comment is a reply if its `thread` field maps to a parent comment
      // via the subThreadToParent map.
      const parentId = subThreadToParent[comment.thread];
      if (typeof parentId === 'number' && parentId !== comment.id && !!_allComments[parentId]) {
        if (!_replies[parentId]) {
          _replies[parentId] = [];
        }
        _replies[parentId].push(comment);
        return;
      }

      _topLevel.push(comment);
    });

    // ⚠️ ВАЖНО: Если topLevel пустой, но есть комментарии - это баг!
    if (_topLevel.length === 0 && comments.length > 0) {
      if (!didWarnAllSubThread.current) {
        console.warn('⚠️ BUG: All comments ended up as replies! Showing them anyway.');
        didWarnAllSubThread.current = true;
      }
      return { topLevel: comments, replies: {} as { [key: number]: TravelComment[] }, allComments: _allComments, subThreadToParent };
    }

    return { topLevel: _topLevel, replies: _replies, allComments: _allComments, subThreadToParent };
  }, [comments]);

  // Walk up the sub-thread chain to find the top-level ancestor comment ID.
  const findTopLevelAncestor = useCallback((commentId: number): number | null => {
    const visited = new Set<number>();
    let current = allComments[commentId];
    if (!current) return commentId;

    while (current) {
      if (visited.has(current.id)) break;
      visited.add(current.id);

      // Find parent: the comment whose sub_thread equals current's thread
      const parentId = subThreadToParent[current.thread];
      if (
        typeof parentId !== 'number' ||
        parentId === current.id ||
        !allComments[parentId]
      ) {
        return current.id;
      }
      current = allComments[parentId];
    }

    return commentId;
  }, [allComments, subThreadToParent]);

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
        return;
      }

      if (replyTo) {
        // Backend reply endpoint can require thread context.
        // Always include thread_id if we have it, and travel_id as a safe fallback.
        replyToComment.mutate(
          {
            commentId: replyTo.id,
            data: {
              text,
              thread_id: replyTo.thread,
              travel_id: travelId,
            },
          },
          {
            onSuccess: () => {
              // Auto-expand the thread that contains the reply so it's visible.
              const topLevelId = findTopLevelAncestor(replyTo.id);
              if (topLevelId != null) {
                setExpandedThreads((prev) => {
                  if (prev.has(topLevelId)) return prev;
                  const next = new Set(prev);
                  next.add(topLevelId);
                  return next;
                });
              }
              setReplyTo(null);
            },
          }
        );
        return;
      }

      // Prefer thread_id once the main thread is known; otherwise fall back to travel_id.
      createComment.mutate({
        text,
        ...(mainThread?.id ? { thread_id: mainThread.id } : { travel_id: travelId }),
      });
    },
    [travelId, mainThread?.id, replyTo, editComment, createComment, updateComment, replyToComment, findTopLevelAncestor]
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

  // Функция для получения полной цепочки родительских комментариев
  const getParentChain = useCallback((commentId: number): TravelComment[] => {
    const chain: TravelComment[] = [];
    const visited = new Set<number>();
    let currentComment = allComments[commentId];

    while (currentComment) {
      if (visited.has(currentComment.id)) {
        break;
      }
      visited.add(currentComment.id);

      const parentId = subThreadToParent[currentComment.thread];
      if (typeof parentId !== 'number' || parentId === currentComment.id) {
        break;
      }

      const parentComment = allComments[parentId];
      if (parentComment) {
        chain.unshift(parentComment);
        currentComment = parentComment;
      } else {
        break;
      }
    }

    return chain;
  }, [allComments, subThreadToParent]);

  // Функция для рендеринга комментария с его родительской цепочкой
  const renderCommentWithParents = useCallback((comment: TravelComment, showParents: boolean = false) => {
    if (!showParents) {
      return null;
    }

    const parentChain = getParentChain(comment.id);

    if (parentChain.length === 0) {
      return null;
    }

    return (
      <View style={styles.parentChainContainer}>
        <View style={styles.parentChainHeader}>
          <Feather name="corner-down-right" size={16} color={DESIGN_TOKENS.colors.textMuted} />
          <Text style={styles.parentChainLabel}>
            Ответ в треде (показаны {parentChain.length + 1} из {parentChain.length + 1 + (replies[comment.id]?.length || 0)} сообщений)
          </Text>
        </View>
        {parentChain.map((parentComment, index) => (
          <CommentItem
            key={parentComment.id}
            comment={parentComment}
            onReply={isAuthenticated ? handleReply : undefined}
            onEdit={isAuthenticated ? handleEdit : undefined}
            level={index}
          />
        ))}
      </View>
    );
  }, [getParentChain, replies, isAuthenticated, handleReply, handleEdit, styles.parentChainContainer, styles.parentChainHeader, styles.parentChainLabel]);

  const toggleThread = useCallback((commentId: number) => {
    setExpandedThreads((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  }, []);

  const expandAllThreads = useCallback(() => {
    const allThreadIds = topLevel
      .filter((comment) => replies[comment.id] && replies[comment.id].length > 0)
      .map((comment) => comment.id);
    setExpandedThreads(new Set(allThreadIds));
  }, [topLevel, replies]);

  const collapseAllThreads = useCallback(() => {
    setExpandedThreads(new Set());
  }, []);

  const isLoading = isLoadingThread || isLoadingComments;
  // Thread metadata is optional — comments are readable by everyone via travel_id
  // fallback, so only commentsError should block the UI.
  const error = commentsError;
  const isSubmitting =
    createComment.isPending || updateComment.isPending || replyToComment.isPending;

  const handleLoginPress = useCallback(() => {
    sendAnalyticsEvent('AuthCtaClicked', {
      source: 'comments',
      intent: 'comment',
      travelId,
    });

    const redirectPath = `${pathname || '/'}#comments`;
    router.push(`/login?intent=comment&redirect=${encodeURIComponent(redirectPath)}` as any);
  }, [pathname, router, travelId]);

  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.centerContainer} testID="comments-skeleton">
        <CommentsSkeleton />
      </View>
    );
  }

  // Show error but still allow creating comments
  const hasError = !!error;
  if (hasError) {
    devWarn('Comments error:', { threadError, commentsError, mainThread, travelId });
  }

  return (
    <View style={styles.container} nativeID="comments">
      <View style={styles.header}>
        <Feather name="message-circle" size={24} color={colors.text} />
        <Text style={styles.title}>
          Комментарии {comments.length > 0 && `(${comments.length})`}
        </Text>
      </View>

      {hasError && (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Feather name="alert-triangle" size={16} color={colors.warning} />
          <Text style={styles.errorBannerText}>
            Не удалось загрузить комментарии. Проверьте соединение и попробуйте ещё раз.
          </Text>
          <Pressable
            onPress={handleRefresh}
            style={styles.errorBannerButton}
            accessibilityRole="button"
            accessibilityLabel="Повторить загрузку комментариев"
          >
            <Text style={styles.errorBannerButtonText}>Повторить</Text>
          </Pressable>
        </View>
      )}

      {/* Управление тредами - если есть вложенные комментарии */}
      {Object.keys(replies).length > 0 && (
        <View style={styles.threadControls}>
          <Pressable
            onPress={expandAllThreads}
            style={styles.threadControlButton}
            accessibilityLabel="Развернуть все треды"
          >
            <Feather name="maximize-2" size={16} color={colors.primary} />
            <Text style={styles.threadControlText}>Развернуть все</Text>
          </Pressable>
          <Pressable
            onPress={collapseAllThreads}
            style={styles.threadControlButton}
            accessibilityLabel="Свернуть все треды"
          >
            <Feather name="minimize-2" size={16} color={colors.primary} />
            <Text style={styles.threadControlText}>Свернуть все</Text>
          </Pressable>
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
        <Pressable
          onPress={handleLoginPress}
          style={styles.loginPrompt}
          accessibilityRole="button"
          accessibilityLabel="Войти, чтобы оставить комментарий"
        >
          <View style={styles.loginPromptRow}>
            <Feather name="log-in" size={18} color={colors.primary} />
            <Text style={styles.loginText}>Войдите, чтобы оставить комментарий</Text>
          </View>
        </Pressable>
      )}

      {/* P0-4: Заменён ScrollView на View — компонент уже внутри главного ScrollView страницы */}
      <View style={styles.commentsList}>
        {hasError && topLevel.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="message-circle" size={48} color={colors.disabled} />
            <Text style={styles.emptyText}>Комментарии недоступны</Text>
            <Text style={styles.emptySubtext}>Попробуйте обновить страницу или повторить позже</Text>
          </View>
        ) : topLevel.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="message-circle" size={48} color={colors.disabled} />
            <Text style={styles.emptyText}>Пока нет комментариев</Text>
            <Text style={styles.emptySubtext}>Будьте первым, кто оставит комментарий!</Text>
          </View>
        ) : (
          topLevel.map((comment) => {
            const hasReplies = replies[comment.id] && replies[comment.id].length > 0;
            const isExpanded = expandedThreads.has(comment.id);

            return (
              <View key={comment.id} style={styles.commentThread}>
                <CommentItem
                  comment={comment}
                  onReply={isAuthenticated ? handleReply : undefined}
                  onEdit={isAuthenticated ? handleEdit : undefined}
                  level={0}
                />

                {hasReplies && (
                  <>
                    <Pressable
                      onPress={() => toggleThread(comment.id)}
                      style={styles.toggleThreadButton}
                      accessibilityLabel={isExpanded ? 'Свернуть ответы' : 'Показать ответы'}
                    >
                      <View style={styles.threadLine} />
                      <Feather
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={colors.primary}
                      />
                      <Text style={styles.toggleThreadText}>
                        {isExpanded
                          ? `Свернуть ответы (${replies[comment.id].length})`
                          : `Показать ответы (${replies[comment.id].length})`}
                      </Text>
                    </Pressable>

                    {isExpanded && (
                      <View style={styles.repliesContainer}>
                        {replies[comment.id].map((reply) => {
                          const parentChain = getParentChain(reply.id);
                          const hasParentChain = parentChain.length > 1;

                          return (
                            <View key={reply.id}>
                              {hasParentChain && renderCommentWithParents(reply, true)}

                              <CommentItem
                                comment={reply}
                                onReply={isAuthenticated ? handleReply : undefined}
                                onEdit={isAuthenticated ? handleEdit : undefined}
                                level={hasParentChain ? parentChain.length : 1}
                              />

                              {replies[reply.id] && replies[reply.id].length > 0 && (
                                <View style={styles.nestedRepliesContainer}>
                                  {replies[reply.id].map((nestedReply) => (
                                    <CommentItem
                                      key={nestedReply.id}
                                      comment={nestedReply}
                                      onReply={isAuthenticated ? handleReply : undefined}
                                      onEdit={isAuthenticated ? handleEdit : undefined}
                                      level={2}
                                    />
                                  ))}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create<Record<string, any>>({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: Platform.select({ default: DESIGN_TOKENS.spacing.md, web: DESIGN_TOKENS.spacing.lg }),
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
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
    gap: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.lg,
    paddingBottom: DESIGN_TOKENS.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    fontSize: Platform.select({ default: 20, web: 22 }),
    fontWeight: DESIGN_TOKENS.typography.weights.semibold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  loginPrompt: {
    backgroundColor: colors.primarySoft,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      } as any,
    }),
  },
  loginPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  loginText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md - 1,
    color: colors.primaryText,
    fontWeight: DESIGN_TOKENS.typography.weights.medium,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warningAlpha40,
  },
  errorBannerText: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.warning,
    fontWeight: DESIGN_TOKENS.typography.weights.medium,
  },
  errorBannerButton: {
    paddingVertical: DESIGN_TOKENS.spacing.xxs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.warningAlpha40,
  },
  errorBannerButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm - 1,
    color: colors.warning,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold,
  },
  commentsList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: DESIGN_TOKENS.spacing.xxl,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
  },
  emptyText: {
    fontSize: Platform.select({ default: 17, web: 18 }),
    fontWeight: DESIGN_TOKENS.typography.weights.semibold,
    color: colors.textMuted,
    marginTop: DESIGN_TOKENS.spacing.md,
    letterSpacing: -0.2,
  },
  emptySubtext: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textTertiary,
    marginTop: DESIGN_TOKENS.spacing.xs,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.primaryText,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold,
  },
  errorText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.textMuted,
    marginTop: DESIGN_TOKENS.spacing.md,
  },
  errorSubtext: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textTertiary,
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
  threadControls: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
  },
  threadControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      } as any,
    }),
  },
  threadControlText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.primaryText,
    fontWeight: DESIGN_TOKENS.typography.weights.medium,
  },
  commentThread: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  toggleThreadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    marginLeft: DESIGN_TOKENS.spacing.xl,
    marginTop: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  threadLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.primaryAlpha30,
  },
  toggleThreadText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.primaryText,
    fontWeight: DESIGN_TOKENS.typography.weights.medium,
  },
  repliesContainer: {
    marginLeft: DESIGN_TOKENS.spacing.md,
    paddingLeft: DESIGN_TOKENS.spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  nestedRepliesContainer: {
    marginLeft: DESIGN_TOKENS.spacing.lg,
    paddingLeft: DESIGN_TOKENS.spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.borderLight,
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
  parentChainContainer: {
    backgroundColor: colors.surfaceAlpha40,
    borderRadius: DESIGN_TOKENS.radii.sm,
    padding: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryAlpha50,
  },
  parentChainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.xs,
    paddingBottom: DESIGN_TOKENS.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  parentChainLabel: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
