import { useEffect, useMemo, useState } from 'react';
import { Platform, View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { CommentsSkeleton } from '@/components/travel/TravelDetailSkeletons';
import { devWarn } from '@/utils/logger';
import { CommentForm } from './CommentForm';
import { CommentThread } from './CommentThread';
import { useCommentsData } from '@/hooks/useCommentsData';
import { createCommentsSectionStyles } from './CommentsSection.styles';
import { translate as i18nT } from '@/i18n'


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
  const [visibleCount, setVisibleCount] = useState(20);

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
    return (
      <View nativeID="comments" style={styles.centerContainer} testID="comments-skeleton">
        <CommentsSkeleton />
      </View>
    );
  }

  if (hasError) {
    devWarn('Comments error:', { threadError, commentsError, mainThread, travelId });
  }

  return (
    <View style={styles.container} nativeID="comments">
      <View style={styles.header}>
        <Feather name="message-circle" size={24} color={colors.text} />
        <Text style={styles.title}>{i18nT('travel:components.travel.CommentsSection.kommentarii_df5d792f')}{comments.length > 0 && `(${comments.length})`}</Text>
      </View>

      {!isEnabled && (
        <View style={styles.loadPrompt}>
          <Text style={styles.loadPromptText}>
            {canLoadComments
              ? i18nT('travel:components.travel.CommentsSection.posmotrite_chto_pishut_drugie_puteshestvenni_221ef281')
              : i18nT('travel:components.travel.CommentsSection.kommentarii_seychas_nedostupny_dlya_etogo_ma_b4c5bab5')}
          </Text>
          {canLoadComments ? (
            <Pressable
              onPress={() => setIsEnabled(true)}
              style={styles.loadPromptButton}
              accessibilityRole="button"
              accessibilityLabel={i18nT('travel:components.travel.CommentsSection.zagruzit_kommentarii_ea914786')}
            >
              <Feather name="message-circle" size={16} color={colors.primaryText} />
              <Text style={styles.loadPromptButtonText}>{i18nT('travel:components.travel.CommentsSection.zagruzit_kommentarii_ea914786')}</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {!isEnabled ? null : (
        <>

          {hasError && (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <Feather name="alert-triangle" size={16} color={colors.warning} />
              <Text style={styles.errorBannerText}>{i18nT('travel:components.travel.CommentsSection.ne_udalos_zagruzit_kommentarii_proverte_soed_f717eb8f')}</Text>
              <Pressable onPress={handleRefresh} style={styles.errorBannerButton} accessibilityRole="button" accessibilityLabel={i18nT('travel:components.travel.CommentsSection.povtorit_zagruzku_kommentariev_e5cffc5a')}>
                <Text style={styles.errorBannerButtonText}>{i18nT('travel:components.travel.CommentsSection.povtorit_0a31dc37')}</Text>
              </Pressable>
            </View>
          )}

          {Object.keys(replies).length > 0 && (
            <View style={styles.threadControls}>
              <Pressable onPress={expandAllThreads} style={styles.threadControlButton} accessibilityLabel={i18nT('travel:components.travel.CommentsSection.razvernut_vse_tredy_ac91df7f')}>
                <Feather name="maximize-2" size={16} color={colors.primaryDark} />
                <Text style={styles.threadControlText}>{i18nT('travel:components.travel.CommentsSection.razvernut_vse_5aab8aba')}</Text>
              </Pressable>
              <Pressable onPress={collapseAllThreads} style={styles.threadControlButton} accessibilityLabel={i18nT('travel:components.travel.CommentsSection.svernut_vse_tredy_11d9c328')}>
                <Feather name="minimize-2" size={16} color={colors.primaryDark} />
                <Text style={styles.threadControlText}>{i18nT('travel:components.travel.CommentsSection.svernut_vse_71f3cb01')}</Text>
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
            <Pressable onPress={handleLoginPress} style={styles.loginPrompt} accessibilityRole="button" accessibilityLabel={i18nT('travel:components.travel.CommentsSection.voyti_chtoby_ostavit_kommentariy_577d7abb')}>
              <View style={styles.loginPromptRow}>
                <Feather name="log-in" size={18} color={colors.primaryDark} />
                <Text style={styles.loginText}>{i18nT('travel:components.travel.CommentsSection.voydite_chtoby_ostavit_kommentariy_444ce693')}</Text>
              </View>
            </Pressable>
          )}

          <View style={styles.commentsList}>
            {hasError && topLevel.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="message-circle" size={48} color={colors.disabled} />
                <Text style={styles.emptyText}>{i18nT('travel:components.travel.CommentsSection.kommentarii_nedostupny_95adf33a')}</Text>
                <Text style={styles.emptySubtext}>{i18nT('travel:components.travel.CommentsSection.poprobuyte_obnovit_stranitsu_ili_povtorit_po_b28b8844')}</Text>
              </View>
            ) : topLevel.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIconWrap}>
                  <Feather name="message-circle" size={28} color={colors.primaryDark} />
                </View>
                <Text style={styles.emptyText}>{i18nT('travel:components.travel.CommentsSection.poka_net_kommentariev_58dc3990')}</Text>
                <Text style={styles.emptySubtext}>
                  {isAuthenticated
                    ? i18nT('travel:components.travel.CommentsSection.ostavte_pervyy_kommentariy_forma_uzhe_otkryt_267b4a0b')
                    : i18nT('travel:components.travel.CommentsSection.nachnite_obsuzhdenie_pervym_voydite_i_ostavt_57f6dfdc')}
                </Text>
                {!isAuthenticated && (
                  <Pressable
                    onPress={handleLoginPress}
                    style={styles.emptyActionButton}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('travel:components.travel.CommentsSection.voyti_chtoby_ostavit_pervyy_kommentariy_490a9ec8')}
                  >
                    <Feather name="log-in" size={16} color={colors.textOnPrimary} />
                    <Text style={styles.emptyActionButtonText}>{i18nT('travel:components.travel.CommentsSection.voyti_i_napisat_kommentariy_a713b7cb')}</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                {topLevel.slice(0, visibleCount).map((comment) => {
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
                })}
                {topLevel.length > visibleCount && (
                  <Pressable
                    onPress={() => setVisibleCount((c) => c + 20)}
                    style={styles.loadPromptButton}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('travel:components.travel.CommentsSection.pokazat_esche_kommentarii_009ae890')}
                  >
                    <Feather name="chevron-down" size={16} color={colors.primaryText} />
                    <Text style={styles.loadPromptButtonText}>
                      {i18nT('travel:components.travel.CommentsSection.pokazat_esche_value1_037816c8', { value1: topLevel.length - visibleCount })}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </>
      )}
    </View>
  );
}
