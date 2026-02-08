import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { useAuth } from '@/context/AuthContext';
import { buildLoginHref } from '@/utils/authNavigation';
import { useThreads, useThreadMessages, useSendMessage, useAvailableUsers } from '@/hooks/useMessages';
import { fetchThreadByUser, getMessagingUserDisplayName, getMessagingUserId } from '@/api/messages';
import type { MessageThread } from '@/api/messages';
import ThreadList from '@/components/messages/ThreadList';
import ChatView from '@/components/messages/ChatView';
import EmptyState from '@/components/ui/EmptyState';
import { useThemedColors } from '@/hooks/useTheme';
import { buildCanonicalUrl } from '@/utils/seo';
import { devError } from '@/utils/logger';

const InstantSEO = React.lazy(() => import('@/components/seo/LazyInstantSEO'));

export default function MessagesScreen() {
    const router = useRouter();
    const isFocused = useIsFocused();
    const { isAuthenticated, authReady, userId } = useAuth();
    const colors = useThemedColors();
    const params = useLocalSearchParams<{ userId?: string; threadId?: string }>();

    const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
    const [initialLoading, setInitialLoading] = useState(false);

    const { threads, loading: threadsLoading, error: threadsError, refresh: refreshThreads } = useThreads();
    const { messages, loading: messagesLoading, refresh: refreshMessages, hasMore, loadMore } = useThreadMessages(
        selectedThread?.id ?? null
    );
    const { send, sending } = useSendMessage();
    const { users } = useAvailableUsers();

    const participantNames = useMemo(() => {
        const map = new Map<number, string>();
        for (const u of users) {
            const uid = getMessagingUserId(u);
            map.set(uid, getMessagingUserDisplayName(u));
        }
        return map;
    }, [users]);

    const participantAvatars = useMemo(() => {
        const map = new Map<number, string | null>();
        for (const u of users) {
            const uid = getMessagingUserId(u);
            map.set(uid, u.avatar ?? null);
        }
        return map;
    }, [users]);

    const otherUserId = useMemo(() => {
        if (!selectedThread || !userId) return null;
        const currentUserIdNum = Number(userId);
        return selectedThread.participants.find((id) => id !== currentUserIdNum) ?? null;
    }, [selectedThread, userId]);

    const otherUserName = useMemo(() => {
        if (otherUserId != null && participantNames.has(otherUserId)) {
            return participantNames.get(otherUserId)!;
        }
        return 'Пользователь';
    }, [otherUserId, participantNames]);

    const otherUserAvatar = useMemo(() => {
        if (otherUserId != null && participantAvatars.has(otherUserId)) {
            return participantAvatars.get(otherUserId) ?? null;
        }
        return null;
    }, [otherUserId, participantAvatars]);

    // Deep-link: open thread with a specific user
    useEffect(() => {
        if (!params.userId || !isAuthenticated || !authReady) return;
        const targetUserId = Number(params.userId);
        if (isNaN(targetUserId)) return;

        let cancelled = false;
        setInitialLoading(true);

        (async () => {
            try {
                const res = await fetchThreadByUser(targetUserId);
                if (cancelled) return;

                if (res.thread_id != null) {
                    const existing = threads.find((t) => t.id === res.thread_id);
                    if (existing) {
                        setSelectedThread(existing);
                    } else {
                        setSelectedThread({
                            id: res.thread_id,
                            participants: [Number(userId), targetUserId],
                            created_at: null,
                            last_message_created_at: null,
                        });
                    }
                } else {
                    // No existing thread — create a virtual one for sending
                    setSelectedThread({
                        id: -1,
                        participants: [Number(userId), targetUserId],
                        created_at: null,
                        last_message_created_at: null,
                    });
                }
            } catch (e) {
                devError('MessagesScreen: fetchThreadByUser error:', e);
                // Still open a virtual thread so user can send
                setSelectedThread({
                    id: -1,
                    participants: [Number(userId), targetUserId],
                    created_at: null,
                    last_message_created_at: null,
                });
            } finally {
                if (!cancelled) setInitialLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [params.userId, isAuthenticated, authReady, userId, threads]);

    // Deep-link: open specific thread by ID
    useEffect(() => {
        if (!params.threadId || !isAuthenticated || !authReady) return;
        const tid = Number(params.threadId);
        if (isNaN(tid)) return;
        const found = threads.find((t) => t.id === tid);
        if (found) setSelectedThread(found);
    }, [params.threadId, isAuthenticated, authReady, threads]);

    const handleSelectThread = useCallback((thread: MessageThread) => {
        setSelectedThread(thread);
    }, []);

    const handleBack = useCallback(() => {
        setSelectedThread(null);
        refreshThreads();
    }, [refreshThreads]);

    const handleSend = useCallback(
        async (text: string) => {
            if (!selectedThread || !userId) return;
            const currentUserIdNum = Number(userId);
            const otherIds = selectedThread.participants.filter((id) => id !== currentUserIdNum);
            const participants = otherIds.length > 0 ? otherIds : selectedThread.participants;

            const ok = await send(participants, text);
            if (ok) {
                refreshMessages();
                // If it was a virtual thread, refresh thread list to get the real one
                if (selectedThread.id === -1) {
                    refreshThreads();
                }
            }
        },
        [selectedThread, userId, send, refreshMessages, refreshThreads]
    );

    // Not authenticated
    if (authReady && !isAuthenticated) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {isFocused && (
                    <React.Suspense fallback={null}>
                        <InstantSEO
                            headKey="messages"
                            title="Сообщения | Metravel"
                            description="Личные сообщения"
                            canonical={buildCanonicalUrl('/messages')}
                            robots="noindex,nofollow"
                        />
                    </React.Suspense>
                )}
                <EmptyState
                    icon="log-in"
                    title="Войдите в аккаунт"
                    description="Для доступа к сообщениям необходимо авторизоваться"
                    action={{
                        label: 'Войти',
                        onPress: () => router.push(buildLoginHref({ redirect: '/messages' }) as any),
                    }}
                />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {isFocused && (
                <React.Suspense fallback={null}>
                    <InstantSEO
                        headKey="messages"
                        title="Сообщения | Metravel"
                        description="Личные сообщения"
                        canonical={buildCanonicalUrl('/messages')}
                        robots="noindex,nofollow"
                    />
                </React.Suspense>
            )}

            {selectedThread ? (
                <ChatView
                    messages={messages}
                    loading={messagesLoading || initialLoading}
                    sending={sending}
                    currentUserId={userId}
                    otherUserName={otherUserName}
                    otherUserAvatar={otherUserAvatar}
                    onSend={handleSend}
                    onBack={handleBack}
                    onLoadMore={loadMore}
                    hasMore={hasMore}
                />
            ) : (
                <ThreadList
                    threads={threads}
                    loading={threadsLoading || initialLoading}
                    error={threadsError}
                    currentUserId={userId}
                    participantNames={participantNames}
                    participantAvatars={participantAvatars}
                    onSelectThread={handleSelectThread}
                    onRefresh={refreshThreads}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        ...(Platform.OS === 'web'
            ? { minHeight: '60vh' as any, maxWidth: 800, width: '100%', alignSelf: 'center' as any }
            : {}),
    },
});
