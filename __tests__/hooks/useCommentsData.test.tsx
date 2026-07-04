import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCommentsData } from '@/hooks/useCommentsData';
import {
  useTravelComments,
  useTravelCommentTree,
  useCreateComment,
  useUpdateComment,
  useReplyToComment,
} from '@/hooks/useComments';
import { useAuth } from '@/context/AuthContext';
import type {
  TravelComment,
  TravelCommentTree,
  TravelCommentTreeNode,
} from '@/types/comments';

jest.mock('@/hooks/useComments');
jest.mock('@/context/AuthContext');
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/travels/test-slug',
}));
jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: jest.fn(),
}));

const mockUseTravelComments = useTravelComments as jest.MockedFunction<typeof useTravelComments>;
const mockUseTravelCommentTree = useTravelCommentTree as jest.MockedFunction<
  typeof useTravelCommentTree
>;
const mockUseCreateComment = useCreateComment as jest.MockedFunction<typeof useCreateComment>;
const mockUseUpdateComment = useUpdateComment as jest.MockedFunction<typeof useUpdateComment>;
const mockUseReplyToComment = useReplyToComment as jest.MockedFunction<typeof useReplyToComment>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const flatComment = (over: Partial<TravelComment> & { id: number; thread: number }): TravelComment => ({
  sub_thread: null,
  user: 1,
  text: `c${over.id}`,
  created_at: null,
  updated_at: null,
  likes_count: 0,
  ...over,
});

const treeNode = (
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

const treeQueryResult = (data: TravelCommentTree | null) =>
  ({ data, isLoading: false, error: null, refetch: jest.fn() }) as any;

const flatQueryResult = (data: TravelComment[]) =>
  ({ data, isLoading: false, error: null, refetch: jest.fn() }) as any;

describe('useCommentsData', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      {children}
    </QueryClientProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      userId: null,
      username: '',
      isSuperuser: false,
      userAvatar: null,
      authReady: true,
      profileRefreshToken: 0,
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      setUserAvatar: jest.fn(),
      triggerProfileRefresh: jest.fn(),
      invalidateAuthState: jest.fn(),
      checkAuthentication: jest.fn(async () => undefined),
      logout: jest.fn(),
      login: jest.fn(),
      loginWithGoogle: jest.fn(async () => true),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    });

    mockUseTravelCommentTree.mockReturnValue(
      treeQueryResult({ travel_id: 123, total_count: 0, top_level: [], flat: [] }),
    );
    mockUseTravelComments.mockReturnValue(flatQueryResult([]));

    mockUseCreateComment.mockReturnValue({ mutate: jest.fn(), isPending: false } as any);
    mockUseUpdateComment.mockReturnValue({ mutate: jest.fn(), isPending: false } as any);
    mockUseReplyToComment.mockReturnValue({ mutate: jest.fn(), isPending: false } as any);
  });

  it('prefers the canonical tree query and skips the flat query when tree is available', () => {
    renderHook(() => useCommentsData(123), { wrapper });

    expect(mockUseTravelCommentTree).toHaveBeenCalledWith(123, { enabled: true });
    // Flat fallback stays disabled while the canonical tree payload exists.
    expect(mockUseTravelComments).toHaveBeenCalledWith(123, undefined, { enabled: false });
  });

  it('does not fetch comments when disabled', () => {
    renderHook(() => useCommentsData(123, { enabled: false }), { wrapper });

    expect(mockUseTravelCommentTree).toHaveBeenCalledWith(123, { enabled: false });
    expect(mockUseTravelComments).toHaveBeenCalledWith(123, undefined, { enabled: false });
  });

  it('returns an empty thread model for an empty tree', () => {
    const { result } = renderHook(() => useCommentsData(123), { wrapper });

    expect(result.current.comments).toEqual([]);
    expect(result.current.topLevel).toEqual([]);
  });

  it('maps a top-level-only tree without replies', () => {
    mockUseTravelCommentTree.mockReturnValue(
      treeQueryResult({
        travel_id: 123,
        total_count: 2,
        top_level: [
          treeNode({ id: 1, thread: 9 }),
          treeNode({ id: 2, thread: 9 }),
        ],
        flat: [flatComment({ id: 1, thread: 9 }), flatComment({ id: 2, thread: 9 })],
      }),
    );

    const { result } = renderHook(() => useCommentsData(123), { wrapper });

    expect(result.current.topLevel.map((c) => c.id)).toEqual([1, 2]);
    expect(result.current.replies).toEqual({});
    expect(result.current.comments).toHaveLength(2);
  });

  it('maps nested replies from the tree and resolves the parent chain', () => {
    // Root (id 1) opens sub_thread 50; its reply (id 2, thread 50) opens
    // sub_thread 60; grandchild (id 3, thread 60).
    mockUseTravelCommentTree.mockReturnValue(
      treeQueryResult({
        travel_id: 123,
        total_count: 3,
        top_level: [
          treeNode({
            id: 1,
            thread: 9,
            sub_thread: 50,
            replies_count: 1,
            replies: [
              treeNode({
                id: 2,
                thread: 50,
                sub_thread: 60,
                depth: 1,
                replies_count: 1,
                replies: [treeNode({ id: 3, thread: 60, depth: 2 })],
              }),
            ],
          }),
        ],
        flat: [
          flatComment({ id: 1, thread: 9, sub_thread: 50 }),
          flatComment({ id: 2, thread: 50, sub_thread: 60 }),
          flatComment({ id: 3, thread: 60 }),
        ],
      }),
    );

    const { result } = renderHook(() => useCommentsData(123), { wrapper });

    expect(result.current.topLevel.map((c) => c.id)).toEqual([1]);
    expect(result.current.replies[1]?.map((c) => c.id)).toEqual([2]);
    expect(result.current.replies[2]?.map((c) => c.id)).toEqual([3]);
    expect(result.current.getParentChain(3).map((c) => c.id)).toEqual([1, 2]);
  });

  it('falls back to the flat path when the tree endpoint is unavailable (404 -> null)', () => {
    mockUseTravelCommentTree.mockReturnValue(treeQueryResult(null));
    mockUseTravelComments.mockReturnValue(
      flatQueryResult([
        flatComment({ id: 1, thread: 9, sub_thread: 50 }),
        flatComment({ id: 2, thread: 50 }),
      ]),
    );

    const { result } = renderHook(() => useCommentsData(123), { wrapper });

    // Flat query becomes enabled once the tree query settles without a payload.
    expect(mockUseTravelComments).toHaveBeenCalledWith(123, undefined, { enabled: true });
    expect(result.current.topLevel.map((c) => c.id)).toEqual([1]);
    expect(result.current.replies[1]?.map((c) => c.id)).toEqual([2]);
  });
});
