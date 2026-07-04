import {
    collectLegacyPeerIds,
    collectParticipantPreviews,
    getParticipantPreviewDisplayName,
    threadHasParticipantPreviews,
    type MessageThread,
    type ParticipantPreview,
} from '@/api/messages';

const preview = (overrides: Partial<ParticipantPreview> = {}): ParticipantPreview => ({
    id: 2,
    display_name: 'Siarhey',
    avatar_url: null,
    username: 'siarhey',
    is_deleted: false,
    ...overrides,
});

const thread = (overrides: Partial<MessageThread> = {}): MessageThread => ({
    id: 1,
    participants: [1, 2],
    created_at: null,
    last_message_created_at: null,
    unread_count: 0,
    ...overrides,
});

describe('participant_previews mapping (#708)', () => {
    describe('getParticipantPreviewDisplayName', () => {
        it('prefers display_name', () => {
            expect(getParticipantPreviewDisplayName(preview({ display_name: 'Сергей', username: 'serg' }))).toBe('Сергей');
        });

        it('falls back to username when display_name is empty', () => {
            expect(getParticipantPreviewDisplayName(preview({ display_name: '  ', username: 'serg' }))).toBe('serg');
        });

        it('marks deleted users without names', () => {
            expect(
                getParticipantPreviewDisplayName(preview({ display_name: '', username: null, is_deleted: true })),
            ).toBe('Удалённый пользователь');
        });

        it('returns null when no name available and user is not deleted', () => {
            expect(getParticipantPreviewDisplayName(preview({ display_name: '', username: null }))).toBeNull();
        });
    });

    describe('collectParticipantPreviews', () => {
        it('maps names and avatars from the canonical payload', () => {
            const map = collectParticipantPreviews([
                thread({
                    participant_previews: [
                        preview({ id: 2, display_name: 'Siarhey', avatar_url: null }),
                        preview({
                            id: 104,
                            display_name: 'Сергей',
                            username: null,
                            avatar_url: 'https://metravel.by/avatar/104.webp',
                        }),
                    ],
                }),
            ]);

            expect(map.get(2)).toEqual({ name: 'Siarhey', avatar: null });
            expect(map.get(104)).toEqual({ name: 'Сергей', avatar: 'https://metravel.by/avatar/104.webp' });
        });

        it('returns an empty map for old-API threads without previews and skips null threads', () => {
            const map = collectParticipantPreviews([thread(), null, undefined]);
            expect(map.size).toBe(0);
        });

        it('first occurrence wins across threads', () => {
            const map = collectParticipantPreviews([
                thread({ participant_previews: [preview({ id: 2, display_name: 'First' })] }),
                thread({ id: 5, participant_previews: [preview({ id: 2, display_name: 'Second' })] }),
            ]);

            expect(map.get(2)?.name).toBe('First');
        });
    });

    describe('collectLegacyPeerIds (fetchUserProfile fallback gate)', () => {
        it('returns no peers for canonical threads with participant_previews — no N+1', () => {
            const threads = [
                thread({ participant_previews: [preview({ id: 2 })] }),
                thread({ id: 3, participants: [1, 7], participant_previews: [preview({ id: 7 })] }),
            ];

            expect(collectLegacyPeerIds(threads, 1)).toEqual([]);
        });

        it('returns peer ids (excluding self) only for old-API threads without previews', () => {
            const threads = [
                thread({ participants: [1, 2] }),
                thread({ id: 3, participants: [1, 7], participant_previews: [preview({ id: 7 })] }),
                thread({ id: 4, participants: [1, 9] }),
            ];

            expect(collectLegacyPeerIds(threads, 1).sort()).toEqual([2, 9]);
        });
    });

    describe('threadHasParticipantPreviews', () => {
        it('detects canonical vs legacy payload', () => {
            expect(threadHasParticipantPreviews(thread({ participant_previews: [] }))).toBe(true);
            expect(threadHasParticipantPreviews(thread())).toBe(false);
        });
    });
});
