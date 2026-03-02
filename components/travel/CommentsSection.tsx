import React, { useCallback, useMemo } from 'react';
import { Platform, View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { CommentsSkeleton } from '@/components/travel/TravelDetailSkeletons';
import { devWarn } from '@/utils/logger';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import { useCommentsData } from '@/hooks/useCommentsData';
import type { TravelComment } from '@/types/comments';

interface CommentsSectionProps {
  travelId: number;
}

export function CommentsSection({ travelId }: CommentsSectionProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    isAuthenticated, comments, topLevel, replies, getParentChain, expandedThreads,
    replyTo, editComment, isLoading, isRefreshing, isSubmitting, hasError,
    threadError, commentsError, mainThread,
    handleRefresh, handleSubmitComment, handleReply, handleEdit,
    handleCancelReply, handleCancelEdit,
    toggleThread, expandAllThreads, collapseAllThreads, handleLoginPress,
  } = useCommentsData(travelId);

  const renderCommentWithParents = useCallback((comment: TravelComment) => {
    const parentChain = getParentChain(comment.id);
    if (parentChain.length === 0) return null;
    return (
      <View style={styles.parentChainContainer}>
        <View style={styles.parentChainHeader}>
          <Feather name="corner-down-right" size={16} color={DESIGN_TOKENS.colors.textMuted} />
          <Text style={styles.parentChainLabel}>
            Ответ в треде (показаны {parentChain.length + 1} из {parentChain.length + 1 + (replies[comment.id]?.length || 0)} сообщений)
          </Text>
        </View>
        {parentChain.map((parentComment, index) => (
          <CommentItem key={parentComment.id} comment={parentComment} onReply={handleReply} onEdit={handleEdit} level={index} />
        ))}
      </View>
    );
  }, [getParentChain, replies, handleReply, handleEdit, styles]);

  if (isLoading && !isRefreshing) {
    return <View style={styles.centerContainer} testID="comments-skeleton"><CommentsSkeleton /></View>;
  }

  if (hasError) {
    devWarn('Comments error:', { threadError, commentsError, mainThread, travelId });
  }

  return (
    <View style={styles.container} nativeID="comments">
      <View style={styles.header}>
        <Feather name="message-circle" size={24} color={colors.text} />
        <Text style={styles.title}>Комментарии {comments.length > 0 && `(${comments.length})`}</Text>
      </View>

      {hasError && (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Feather name="alert-triangle" size={16} color={colors.warning} />
          <Text style={styles.errorBannerText}>Не удалось загрузить комментарии. Проверьте соединение и попробуйте ещё раз.</Text>
          <Pressable onPress={handleRefresh} style={styles.errorBannerButton} accessibilityRole="button" accessibilityLabel="Повторить загрузку комментариев">
            <Text style={styles.errorBannerButtonText}>Повторить</Text>
          </Pressable>
        </View>
      )}

      {Object.keys(replies).length > 0 && (
        <View style={styles.threadControls}>
          <Pressable onPress={expandAllThreads} style={styles.threadControlButton} accessibilityLabel="Развернуть все треды">
            <Feather name="maximize-2" size={16} color={colors.primary} />
            <Text style={styles.threadControlText}>Развернуть все</Text>
          </Pressable>
          <Pressable onPress={collapseAllThreads} style={styles.threadControlButton} accessibilityLabel="Свернуть все треды">
            <Feather name="minimize-2" size={16} color={colors.primary} />
            <Text style={styles.threadControlText}>Свернуть все</Text>
          </Pressable>
        </View>
      )}

      {isAuthenticated && (
        <CommentForm
          onSubmit={handleSubmitComment} isSubmitting={isSubmitting}
          replyTo={replyTo} onCancelReply={handleCancelReply}
          editComment={editComment} onCancelEdit={handleCancelEdit}
          autoFocus={!!replyTo || !!editComment}
        />
      )}

      {!isAuthenticated && (
        <Pressable onPress={handleLoginPress} style={styles.loginPrompt} accessibilityRole="button" accessibilityLabel="Войти, чтобы оставить комментарий">
          <View style={styles.loginPromptRow}>
            <Feather name="log-in" size={18} color={colors.primary} />
            <Text style={styles.loginText}>Войдите, чтобы оставить комментарий</Text>
          </View>
        </Pressable>
      )}

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
            const hasReplies = replies[comment.id]?.length > 0;
            const isExpanded = expandedThreads.has(comment.id);
            return (
              <View key={comment.id} style={styles.commentThread}>
                <CommentItem comment={comment} onReply={handleReply} onEdit={handleEdit} level={0} />
                {hasReplies && (
                  <>
                    <Pressable onPress={() => toggleThread(comment.id)} style={styles.toggleThreadButton}
                      accessibilityLabel={isExpanded ? 'Свернуть ответы' : 'Показать ответы'}>
                      <View style={styles.threadLine} />
                      <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary} />
                      <Text style={styles.toggleThreadText}>
                        {isExpanded ? `Свернуть ответы (${replies[comment.id].length})` : `Показать ответы (${replies[comment.id].length})`}
                      </Text>
                    </Pressable>
                    {isExpanded && (
                      <View style={styles.repliesContainer}>
                        {replies[comment.id].map((reply) => {
                          const parentChain = getParentChain(reply.id);
                          const hasParentChain = parentChain.length > 1;
                          return (
                            <View key={reply.id}>
                              {hasParentChain && renderCommentWithParents(reply)}
                              <CommentItem comment={reply} onReply={handleReply} onEdit={handleEdit} level={hasParentChain ? parentChain.length : 1} />
                              {replies[reply.id]?.length > 0 && (
                                <View style={styles.nestedRepliesContainer}>
                                  {replies[reply.id].map((nestedReply) => (
                                    <CommentItem key={nestedReply.id} comment={nestedReply} onReply={handleReply} onEdit={handleEdit} level={2} />
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
    flex: 1, backgroundColor: colors.surface,
    padding: Platform.select({ default: DESIGN_TOKENS.spacing.md, web: DESIGN_TOKENS.spacing.lg }),
    borderRadius: DESIGN_TOKENS.radii.md, borderWidth: 1, borderColor: colors.borderLight,
  },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: DESIGN_TOKENS.spacing.xl },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.lg, paddingBottom: DESIGN_TOKENS.spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  title: {
    fontSize: Platform.select({ default: 20, web: 22 }),
    fontWeight: DESIGN_TOKENS.typography.weights.semibold, color: colors.text, letterSpacing: -0.3,
  },
  loginPrompt: {
    backgroundColor: colors.primarySoft, borderRadius: DESIGN_TOKENS.radii.md,
    padding: DESIGN_TOKENS.spacing.md, marginBottom: DESIGN_TOKENS.spacing.md,
    alignItems: 'center', borderWidth: 1, borderColor: colors.primaryAlpha30,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease' } as any }),
  },
  loginPromptRow: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.sm },
  loginText: { fontSize: DESIGN_TOKENS.typography.sizes.md - 1, color: colors.primaryText, fontWeight: DESIGN_TOKENS.typography.weights.medium },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs,
    paddingVertical: DESIGN_TOKENS.spacing.sm, paddingHorizontal: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.md, borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warningAlpha40,
  },
  errorBannerText: { flex: 1, fontSize: DESIGN_TOKENS.typography.sizes.sm, color: colors.warning, fontWeight: DESIGN_TOKENS.typography.weights.medium },
  errorBannerButton: {
    paddingVertical: DESIGN_TOKENS.spacing.xxs, paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.warningAlpha40,
  },
  errorBannerButtonText: { fontSize: DESIGN_TOKENS.typography.sizes.sm - 1, color: colors.warning, fontWeight: DESIGN_TOKENS.typography.weights.semibold },
  commentsList: { flex: 1 },
  emptyState: { alignItems: 'center', paddingVertical: DESIGN_TOKENS.spacing.xxl, paddingHorizontal: DESIGN_TOKENS.spacing.lg },
  emptyText: {
    fontSize: Platform.select({ default: 17, web: 18 }), fontWeight: DESIGN_TOKENS.typography.weights.semibold,
    color: colors.textMuted, marginTop: DESIGN_TOKENS.spacing.md, letterSpacing: -0.2,
  },
  emptySubtext: { fontSize: DESIGN_TOKENS.typography.sizes.sm, color: colors.textTertiary, marginTop: DESIGN_TOKENS.spacing.xs, textAlign: 'center', lineHeight: 20 },
  threadControls: { flexDirection: 'row', gap: DESIGN_TOKENS.spacing.sm, marginBottom: DESIGN_TOKENS.spacing.md, paddingVertical: DESIGN_TOKENS.spacing.xs },
  threadControlButton: {
    flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs,
    paddingVertical: 6, paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    backgroundColor: colors.backgroundSecondary, borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1, borderColor: colors.borderLight,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.15s ease' } as any }),
  },
  threadControlText: { fontSize: DESIGN_TOKENS.typography.sizes.sm, color: colors.primaryText, fontWeight: DESIGN_TOKENS.typography.weights.medium },
  commentThread: { marginBottom: DESIGN_TOKENS.spacing.md },
  toggleThreadButton: {
    flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs,
    paddingVertical: DESIGN_TOKENS.spacing.sm, paddingHorizontal: DESIGN_TOKENS.spacing.md,
    marginLeft: DESIGN_TOKENS.spacing.xl, marginTop: DESIGN_TOKENS.spacing.xs, marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  threadLine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, backgroundColor: colors.primaryAlpha30 },
  toggleThreadText: { fontSize: DESIGN_TOKENS.typography.sizes.sm, color: colors.primaryText, fontWeight: DESIGN_TOKENS.typography.weights.medium },
  repliesContainer: { marginLeft: DESIGN_TOKENS.spacing.md, paddingLeft: DESIGN_TOKENS.spacing.md, borderLeftWidth: 2, borderLeftColor: colors.border },
  nestedRepliesContainer: { marginLeft: DESIGN_TOKENS.spacing.lg, paddingLeft: DESIGN_TOKENS.spacing.md, borderLeftWidth: 2, borderLeftColor: colors.borderLight, marginTop: DESIGN_TOKENS.spacing.xs },
  parentChainContainer: {
    backgroundColor: colors.surfaceAlpha40, borderRadius: DESIGN_TOKENS.radii.sm,
    padding: DESIGN_TOKENS.spacing.sm, marginBottom: DESIGN_TOKENS.spacing.sm,
    borderLeftWidth: 3, borderLeftColor: colors.primaryAlpha50,
  },
  parentChainHeader: {
    flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.xs, paddingBottom: DESIGN_TOKENS.spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  parentChainLabel: { fontSize: DESIGN_TOKENS.typography.sizes.sm, color: colors.textMuted, fontStyle: 'italic' },
});
