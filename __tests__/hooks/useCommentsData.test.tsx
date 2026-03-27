import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCommentsData } from '@/hooks/useCommentsData';
import {
  useMainThread,
  useTravelComments,
  useCreateComment,
  useUpdateComment,
  useReplyToComment,
} from '@/hooks/useComments';
import { useAuth } from '@/context/AuthContext';

jest.mock('@/hooks/useComments');
jest.mock('@/context/AuthContext');
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/travels/test-slug',
}));
jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: jest.fn(),
}));

const mockUseMainThread = useMainThread as jest.MockedFunction<typeof useMainThread>;
const mockUseTravelComments = useTravelComments as jest.MockedFunction<typeof useTravelComments>;
const mockUseCreateComment = useCreateComment as jest.MockedFunction<typeof useCreateComment>;
const mockUseUpdateComment = useUpdateComment as jest.MockedFunction<typeof useUpdateComment>;
const mockUseReplyToComment = useReplyToComment as jest.MockedFunction<typeof useReplyToComment>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

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
      logout: jest.fn(),
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    });

    mockUseMainThread.mockReturnValue({
      data: { id: 9, travel: 123, is_main: true, created_at: null, updated_at: null },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockUseTravelComments.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockUseCreateComment.mockReturnValue({ mutate: jest.fn(), isPending: false } as any);
    mockUseUpdateComment.mockReturnValue({ mutate: jest.fn(), isPending: false } as any);
    mockUseReplyToComment.mockReturnValue({ mutate: jest.fn(), isPending: false } as any);
  });

  it('enables main thread lookup so comment reads can use thread_id-first backends', () => {
    renderHook(() => useCommentsData(123), { wrapper });

    expect(mockUseMainThread).toHaveBeenCalledWith(123, { enabled: true });
    expect(mockUseTravelComments).toHaveBeenCalledWith(123, 9, { enabled: true });
  });
});
