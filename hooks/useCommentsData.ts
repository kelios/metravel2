// hooks/useCommentsData.ts
// E12: Data + thread logic extracted from CommentsSection.tsx

import { useState, useCallback, useMemo, useRef } from 'react';
import { usePathname, useRouter, type Href } from 'expo-router';
import {
  useTravelComments,
  useTravelCommentTree,
  useCreateComment,
  useUpdateComment,
  useReplyToComment,
} from './useComments';
import { useAuth } from '@/context/AuthContext';
import { sendAnalyticsEvent } from '@/utils/analytics';
import { devWarn } from '@/utils/logger';
import type { TravelComment } from '@/types/comments';
import {
  buildCommentThreadModel,
  buildCommentThreadModelFromTree,
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
  const mainThreadId: number | undefined = undefined;

  // Canonical path (BE #711): the backend returns a ready comments tree, so we
  // build the UI model directly from `top_level`/`replies` — no flat-list
  // reconstruction and no BFS sub-thread requests.
  const {
    data: tree,
    isLoading: isLoadingTree,
    error: treeError,
    refetch: refetchTree,
  } = useTravelCommentTree(travelId, { enabled: isEnabled });

  // Flat fallback for older deployments / stale devs where the tree endpoint
  // answers 404 (adapter returns `null`). Only fires once the tree query has
  // settled without a payload, so canonical deployments never issue it.
  const treeUnavailable = !isLoadingTree && !treeError && tree == null;
  const {
    data: flatComments = [],
    isLoading: isLoadingFlat,
    error: flatError,
    refetch: refetchFlat,
  } = useTravelComments(travelId, mainThreadId, {
    enabled: isEnabled && treeUnavailable,
  });

  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const replyToComment = useReplyToComment();

  const comments = useMemo<TravelComment[]>(
    () => (tree ? tree.flat : flatComments),
    [tree, flatComments],
  );

  // Thread structure
  const { topLevel, replies, allComments, subThreadToParent } = useMemo(() => {
    if (tree) {
      return buildCommentThreadModelFromTree(tree.top_level)
    }
    const model = buildCommentThreadModel(flatComments, didWarnAllSubThread.current)
    if (model.warnedAllSubThread && !didWarnAllSubThread.current && flatComments.length > 0) {
      devWarn('[Comments] All comments ended up as replies; showing them as top-level fallback.')
      didWarnAllSubThread.current = true
    }
    return model
  }, [tree, flatComments]);

  const isLoadingComments = isLoadingTree || (treeUnavailable && isLoadingFlat);
  const commentsError = treeError ?? (treeUnavailable ? flatError : null);
  const refetchComments = useCallback(async () => {
    await refetchTree();
    if (treeUnavailable) {
      await refetchFlat();
    }
  }, [refetchTree, refetchFlat, treeUnavailable]);

  const findTopLevelAncestor = useCallback((commentId: number): number | null => {
    return findCommentTopLevelAncestor(commentId, allComments, subThreadToParent)
  }, [allComments, subThreadToParent]);

  const getParentChain = useCallback((commentId: number): TravelComment[] => {
    return getCommentParentChain(commentId, allComments, subThreadToParent)
  }, [allComments, subThreadToParent]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetchComments();
    }
    finally { setIsRefreshing(false); }
  }, [refetchComments]);

  const handleSubmitComment = useCallback(async (text: string) => {
    if (editComment) {
      await updateComment.mutateAsync({ commentId: editComment.id, data: { text } });
      setEditComment(null);
      return;
    }
    if (replyTo) {
      await replyToComment.mutateAsync({
        commentId: replyTo.id,
        data: { text, thread_id: replyTo.thread, travel_id: travelId },
      });
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
      return;
    }
    await createComment.mutateAsync({
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
    isLoading: isLoadingComments,
    isRefreshing,
    isSubmitting: createComment.isPending || updateComment.isPending || replyToComment.isPending,
    hasError: !!commentsError,
    threadError: null,
    commentsError,
    mainThread: null,
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
