import React, { useEffect, useMemo, useState } from 'react';
import { Platform, View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { CommentsSkeleton } from '@/components/travel/TravelDetailSkeletons';
import { devWarn } from '@/utils/logger';
import { CommentForm } from './CommentForm';
import { CommentThread } from './CommentThread';
import { useCommentsData } from '@/hooks/useCommentsData';
import { createCommentsSectionStyles } from './CommentsSection.styles';

interface CommentsSectionProps {
  travelId: number;
  autoload?: boolean;
  lazyLoad?: boolean;
  canLoadComments?: boolean;
}

export function CommentsSection({
  travelId,
  autoload = false,
  lazyLoad = false,
  canLoadComments = true,
}: CommentsSectionProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createCommentsSectionStyles(colors), [colors]);
  const [isEnabled, setIsEnabled] = useState(lazyLoad ? autoload : true);

  useEffect(() => {
    if (!lazyLoad) {
      setIsEnabled(true);
      return;
    }
    if (!autoload) return;
    setIsEnabled(true);
  }, [autoload, lazyLoad]);

  useEffect(() => {
    if (!lazyLoad) return;
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (window.location.hash !== '#comments') return;
    setIsEnabled(true);
  }, [lazyLoad]);

  const {
    isAuthenticated, comments, topLevel, replies, getParentChain, expandedThreads,
    replyTo, editComment, isLoading, isRefreshing, isSubmitting, hasError,
    threadError, commentsError, mainThread,
    handleRefresh, handleSubmitComment, handleReply, handleEdit,
    handleCancelReply, handleCancelEdit,
    toggleThread, expandAllThreads, collapseAllThreads, handleLoginPress,
  } = useCommentsData(travelId, { enabled: isEnabled });

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

      {!isEnabled && (
        <View style={styles.loadPrompt}>
          <Text style={styles.loadPromptText}>
            {canLoadComments
              ? 'Комментарии загружаются по запросу, чтобы не тянуть лишние сетевые вызовы на странице маршрута.'
              : 'Комментарии сейчас недоступны для этого маршрута.'}
          </Text>
          {canLoadComments ? (
            <Pressable
              onPress={() => setIsEnabled(true)}
              style={styles.loadPromptButton}
              accessibilityRole="button"
              accessibilityLabel="Загрузить комментарии"
            >
              <Feather name="message-circle" size={16} color={colors.primaryText} />
              <Text style={styles.loadPromptButtonText}>Загрузить комментарии</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {!isEnabled ? null : (
        <>

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
                <View style={styles.emptyStateIconWrap}>
                  <Feather name="message-circle" size={28} color={colors.primary} />
                </View>
                <Text style={styles.emptyText}>Пока нет комментариев</Text>
                <Text style={styles.emptySubtext}>Будьте первым, кто оставит комментарий!</Text>
              </View>
            ) : (
              topLevel.map((comment) => {
                return (
                  <CommentThread
                    key={comment.id}
                    comment={comment}
                    replies={replies}
                    expandedThreads={expandedThreads}
                    getParentChain={getParentChain}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    onToggleThread={toggleThread}
                    colors={colors}
                    styles={styles}
                  />
                )
              })
            )}
          </View>
        </>
      )}
    </View>
  );
}
