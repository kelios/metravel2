import { renderHook, waitFor } from '@testing-library/react-native';
import { useThreads } from '@/hooks/useMessages';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { getSecureItem } from '@/utils/secureStorage';
import { getCsrfHeader } from '@/utils/csrf';
import type { MessageThread } from '@/api/messages';

jest.mock('@/utils/fetchWithTimeout');
jest.mock('@/utils/secureStorage');
jest.mock('@/utils/csrf');

// Exercise JSON → real messagingFetch/fetchMessageThreads → real useThreads.
// Mock only the transport/auth boundary, never the API or hook being checked.
it('preserves additive previews through the real list pipeline without message fan-out (#2266)', async () => {
    const base: MessageThread = {
        id: 10, participants: [1, 2], created_at: null,
        last_message_created_at: null, unread_count: 0,
    };
    const threads: MessageThread[] = [
        { ...base, last_message_preview: { text: 'API-owned content', sender_id: 2, is_deleted: false } },
        { ...base, id: 11, last_message_preview: { text: 'Hidden payload', sender_id: 1, is_deleted: true } },
        { ...base, id: 12, last_message_preview: null },
        { ...base, id: 13 },
    ];
    const transport = jest.mocked(fetchWithTimeout);
    transport.mockClear();
    jest.mocked(getSecureItem).mockResolvedValue('test-token');
    jest.mocked(getCsrfHeader).mockReturnValue({});
    transport.mockResolvedValueOnce({
        ok: true, status: 200, text: async () => JSON.stringify(threads),
    } as Response);

    const { result } = renderHook(() => useThreads(true, false));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.threads).toEqual(threads);
    expect(result.current.threads[3]).not.toHaveProperty('last_message_preview');
    expect(transport).toHaveBeenCalledTimes(1);
    expect(String(transport.mock.calls[0][0])).toMatch(/\/api\/message-threads\/$/);
});
