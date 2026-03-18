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

export function useCommentsData(travelId: number) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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
  } = useMainThread(travelId, { enabled: true });

  const {
    data: comments = [],
    isLoading: isLoadingComments,
    error: commentsError,
    refetch: refetchComments,
  } = useTravelComments(travelId, mainThread?.id);

  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const replyToComment = useReplyToComment();

  // Thread structure
  const { topLevel, replies, allComments, subThreadToParent } = useMemo(() => {
    const _topLevel: TravelComment[] = [];
    const _replies: Record<number, TravelComment[]> = {};
    const _allComments: Record<number, TravelComment> = {};

    comments.forEach((c) => { _allComments[c.id] = c; });

    const _subThreadToParent: Record<number, number> = {};
    comments.forEach((c) => {
      const st = typeof c.sub_thread === 'string' ? Number(c.sub_thread) : c.sub_thread;
      if (typeof st === 'number' && !Number.isNaN(st) && st > 0) {
        _subThreadToParent[st] = c.id;
      }
    });

    comments.forEach((c) => {
      const parentId = _subThreadToParent[c.thread];
      if (typeof parentId === 'number' && parentId !== c.id && !!_allComments[parentId]) {
        (_replies[parentId] ??= []).push(c);
        return;
      }
      _topLevel.push(c);
    });

    if (_topLevel.length === 0 && comments.length > 0) {
      if (!didWarnAllSubThread.current) {
        console.warn('BUG: All comments ended up as replies! Showing them anyway.');
        didWarnAllSubThread.current = true;
      }
      return { topLevel: comments, replies: {} as Record<number, TravelComment[]>, allComments: _allComments, subThreadToParent: _subThreadToParent };
    }

    return { topLevel: _topLevel, replies: _replies, allComments: _allComments, subThreadToParent: _subThreadToParent };
  }, [comments]);

  const findTopLevelAncestor = useCallback((commentId: number): number | null => {
    const visited = new Set<number>();
    let current = allComments[commentId];
    if (!current) return commentId;
    while (current) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      const parentId = subThreadToParent[current.thread];
      if (typeof parentId !== 'number' || parentId === current.id || !allComments[parentId]) return current.id;
      current = allComments[parentId];
    }
    return commentId;
  }, [allComments, subThreadToParent]);

  const getParentChain = useCallback((commentId: number): TravelComment[] => {
    const chain: TravelComment[] = [];
    const visited = new Set<number>();
    let currentComment = allComments[commentId];
    while (currentComment) {
      if (visited.has(currentComment.id)) break;
      visited.add(currentComment.id);
      const parentId = subThreadToParent[currentComment.thread];
      if (typeof parentId !== 'number' || parentId === currentComment.id) break;
      const parentComment = allComments[parentId];
      if (parentComment) { chain.unshift(parentComment); currentComment = parentComment; }
      else break;
    }
    return chain;
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
