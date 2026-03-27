// hooks/useCommentsData.ts
// E12: Data + thread logic extracted from CommentsSection.tsx

import { useState, useCallback, useMemo, useRef } from 'react';
import { usePathname, useRouter, type Href } from 'expo-router';
import {
  useMainThread,
  useTravelComments,
  useCreateComment,
  useUpdateComment,
  useReplyToComment,
} from './useComments';
import { useAuth } from '@/context/AuthContext';
import { sendAnalyticsEvent } from '@/utils/analytics';
import type { TravelComment } from '@/types/comments';
import {
  buildCommentThreadModel,
  findTopLevelAncestor as findCommentTopLevelAncestor,
  getCommentParentChain,
} from './comments/commentThreadModel';

export function useCommentsData(travelId: number, options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isEnabled = options?.enabled ?? true;

  const [replyTo, setReplyTo] = useState<TravelComment | null>(null);
  const [editComment, setEditComment] = useState<TravelComment | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<number>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const didWarnAllSubThread = useRef(false);

  const {
    data: mainThread,
    isLoading: isLoadingThread,
    error: threadError,
    refetch: refetchThread,
  } = useMainThread(travelId, { enabled: isEnabled });

  const {
    data: comments = [],
    isLoading: isLoadingComments,
    error: commentsError,
    refetch: refetchComments,
  } = useTravelComments(travelId, mainThread?.id, { enabled: isEnabled });

  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const replyToComment = useReplyToComment();

  // Thread structure
  const { topLevel, replies, allComments, subThreadToParent } = useMemo(() => {
    const model = buildCommentThreadModel(comments, didWarnAllSubThread.current)
    if (model.warnedAllSubThread && !didWarnAllSubThread.current && comments.length > 0) {
      console.warn('BUG: All comments ended up as replies! Showing them anyway.')
      didWarnAllSubThread.current = true
    }
    return model
  }, [comments]);

  const findTopLevelAncestor = useCallback((commentId: number): number | null => {
    return findCommentTopLevelAncestor(commentId, allComments, subThreadToParent)
  }, [allComments, subThreadToParent]);

  const getParentChain = useCallback((commentId: number): TravelComment[] => {
    return getCommentParentChain(commentId, allComments, subThreadToParent)
  }, [allComments, subThreadToParent]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try { await Promise.allSettled([refetchThread(), refetchComments()]); }
    finally { setIsRefreshing(false); }
  }, [refetchComments, refetchThread]);

  const handleSubmitComment = useCallback((text: string) => {
    if (editComment) {
      updateComment.mutate({ commentId: editComment.id, data: { text } }, {
        onSuccess: () => setEditComment(null),
      });
      return;
    }
    if (replyTo) {
      replyToComment.mutate(
        { commentId: replyTo.id, data: { text, thread_id: replyTo.thread, travel_id: travelId } },
        {
          onSuccess: () => {
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
    createComment.mutate({
      text,
      travel_id: travelId,
    });
  }, [travelId, replyTo, editComment, createComment, updateComment, replyToComment, findTopLevelAncestor]);

  const handleReply = useCallback((comment: TravelComment) => { setReplyTo(comment); setEditComment(null); }, []);
  const handleEdit = useCallback((comment: TravelComment) => { setEditComment(comment); setReplyTo(null); }, []);
  const handleCancelReply = useCallback(() => setReplyTo(null), []);
  const handleCancelEdit = useCallback(() => setEditComment(null), []);

  const toggleThread = useCallback((commentId: number) => {
    setExpandedThreads((prev) => {
      const s = new Set(prev);
      s.has(commentId) ? s.delete(commentId) : s.add(commentId);
      return s;
    });
  }, []);

  const expandAllThreads = useCallback(() => {
    const ids = topLevel.filter((c) => replies[c.id]?.length > 0).map((c) => c.id);
    setExpandedThreads(new Set(ids));
  }, [topLevel, replies]);

  const collapseAllThreads = useCallback(() => setExpandedThreads(new Set()), []);

  const handleLoginPress = useCallback(() => {
    sendAnalyticsEvent('AuthCtaClicked', { source: 'comments', intent: 'comment', travelId });
    const redirectPath = `${pathname || '/'}#comments`;
    router.push(`/login?intent=comment&redirect=${encodeURIComponent(redirectPath)}` as Href);
  }, [pathname, router, travelId]);

  return {
    isAuthenticated,
    comments,
    topLevel,
    replies,
    getParentChain,
    expandedThreads,
    replyTo,
    editComment,
    isLoading: isLoadingThread || isLoadingComments,
    isRefreshing,
    isSubmitting: createComment.isPending || updateComment.isPending || replyToComment.isPending,
    hasError: !!commentsError,
    threadError,
    commentsError,
    mainThread,
    handleRefresh,
    handleSubmitComment,
    handleReply: isAuthenticated ? handleReply : undefined,
    handleEdit: isAuthenticated ? handleEdit : undefined,
    handleCancelReply,
    handleCancelEdit,
    toggleThread,
    expandAllThreads,
    collapseAllThreads,
    handleLoginPress,
  };
}
