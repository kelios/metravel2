import {
  buildCommentThreadModelFromTree,
  getCommentParentChain,
  findTopLevelAncestor,
} from '@/hooks/comments/commentThreadModel';
import type { TravelCommentTreeNode } from '@/types/comments';

const node = (
  over: Partial<TravelCommentTreeNode> & { id: number; thread: number },
): TravelCommentTreeNode => ({
  sub_thread: null,
  user: 1,
  text: `c${over.id}`,
  created_at: null,
  updated_at: null,
  likes_count: 0,
  depth: 0,
  replies_count: 0,
  replies: [],
  ...over,
});

describe('buildCommentThreadModelFromTree', () => {
  it('returns an empty model for an empty tree', () => {
    const model = buildCommentThreadModelFromTree([]);

    expect(model.topLevel).toEqual([]);
    expect(model.replies).toEqual({});
    expect(model.allComments).toEqual({});
    expect(model.subThreadToParent).toEqual({});
    expect(model.warnedAllSubThread).toBe(false);
  });

  it('maps a top-level-only tree', () => {
    const model = buildCommentThreadModelFromTree([
      node({ id: 1, thread: 9 }),
      node({ id: 2, thread: 9 }),
    ]);

    expect(model.topLevel.map((c) => c.id)).toEqual([1, 2]);
    expect(model.replies).toEqual({});
  });

  it('flattens nested replies and strips tree-only fields', () => {
    const model = buildCommentThreadModelFromTree([
      node({
        id: 1,
        thread: 9,
        sub_thread: 50,
        replies: [
          node({
            id: 2,
            thread: 50,
            sub_thread: 60,
            depth: 1,
            replies: [node({ id: 3, thread: 60, depth: 2 })],
          }),
        ],
      }),
    ]);

    expect(model.topLevel.map((c) => c.id)).toEqual([1]);
    expect(model.replies[1].map((c) => c.id)).toEqual([2]);
    expect(model.replies[2].map((c) => c.id)).toEqual([3]);

    // Stored comments are canonical TravelComment (no replies/depth/replies_count).
    const stored = model.allComments[2] as Record<string, unknown>;
    expect(stored).not.toHaveProperty('replies');
    expect(stored).not.toHaveProperty('depth');
    expect(stored).not.toHaveProperty('replies_count');
  });

  it('builds subThreadToParent so parent-chain traversal works', () => {
    const model = buildCommentThreadModelFromTree([
      node({
        id: 1,
        thread: 9,
        sub_thread: 50,
        replies: [
          node({
            id: 2,
            thread: 50,
            sub_thread: 60,
            depth: 1,
            replies: [node({ id: 3, thread: 60, depth: 2 })],
          }),
        ],
      }),
    ]);

    expect(model.subThreadToParent).toEqual({ 50: 1, 60: 2 });
    expect(
      getCommentParentChain(3, model.allComments, model.subThreadToParent).map((c) => c.id),
    ).toEqual([1, 2]);
    expect(findTopLevelAncestor(3, model.allComments, model.subThreadToParent)).toBe(1);
  });
});
