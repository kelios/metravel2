import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { useAuth } from '@/context/AuthContext';
import { buildLoginHref } from '@/utils/authNavigation';
import { useThreads, useThreadMessages, useSendMessage, useDeleteMessage, useAvailableUsers, useMarkThreadRead } from '@/hooks/useMessages';
import { fetchThreadByUser, getMessagingUserDisplayName, getMessagingUserId } from '@/api/messages';
import type { MessageThread } from '@/api/messages';
import ThreadList from '@/components/messages/ThreadList';
import ChatView from '@/components/messages/ChatView';
import NewConversationPicker from '@/components/messages/NewConversationPicker';
import EmptyState from '@/components/ui/EmptyState';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { buildCanonicalUrl } from '@/utils/seo';
import { devError } from '@/utils/logger';

const InstantSEO = React.lazy(() => import('@/components/seo/LazyInstantSEO'));

export default function MessagesScreen() {
    const router = useRouter();
    const isFocused = useIsFocused();
    const { isAuthenticated, authReady, userId } = useAuth();
    const colors = useThemedColors();
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const isDesktop = Platform.OS === 'web' && !isMobile;
    const params = useLocalSearchParams<{ userId?: string; threadId?: string }>();

    const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
    const [initialLoading, setInitialLoading] = useState(false);
    const [showPicker, setShowPicker] = useState(false);

    const canFetch = authReady && isAuthenticated;
    const { threads, loading: threadsLoading, error: threadsError, refresh: refreshThreads } = useThreads(canFetch, isFocused);
    const { messages, loading: messagesLoading, refresh: refreshMessages, hasMore, loadMore, optimisticRemove } = useThreadMessages(
        selectedThread?.id ?? null, isFocused
    );
    const { send, sending } = useSendMessage();
    const { remove: removeMessage } = useDeleteMessage();
    const { mark: markRead } = useMarkThreadRead();
    const { users } = useAvailableUsers(canFetch);

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
        if (thread.id >= 0) {
            markRead(thread.id);
        }
    }, [markRead]);

    const handleBack = useCallback(() => {
        setSelectedThread(null);
        refreshThreads();
    }, [refreshThreads]);

    const handleNewConversation = useCallback(() => {
        setShowPicker(true);
    }, []);

    const handlePickerClose = useCallback(() => {
        setShowPicker(false);
    }, []);

    const handlePickUser = useCallback(
        async (targetUserId: number) => {
            setShowPicker(false);
            if (!userId) return;

            try {
                const res = await fetchThreadByUser(targetUserId);
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
                    setSelectedThread({
                        id: -1,
                        participants: [Number(userId), targetUserId],
                        created_at: null,
                        last_message_created_at: null,
                    });
                }
            } catch (e) {
                devError('handlePickUser error:', e);
                setSelectedThread({
                    id: -1,
                    participants: [Number(userId), targetUserId],
                    created_at: null,
                    last_message_created_at: null,
                });
            }
        },
        [userId, threads]
    );

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

    const handleDeleteMessage = useCallback(
        async (messageId: number) => {
            const rollback = optimisticRemove(messageId);
            const ok = await removeMessage(messageId);
            if (!ok) {
                rollback();
            }
        },
        [removeMessage, optimisticRemove]
    );

    // Not authenticated
    if (authReady && !isAuthenticated) {
        return (
            <View style={[styles.mobileContainer, { backgroundColor: colors.background }]}>
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

    const seoBlock = isFocused ? (
        <React.Suspense fallback={null}>
            <InstantSEO
                headKey="messages"
                title="Сообщения | Metravel"
                description="Личные сообщения"
                canonical={buildCanonicalUrl('/messages')}
                robots="noindex,nofollow"
            />
        </React.Suspense>
    ) : null;

    const sidebar = (
        <View style={[
            isDesktop ? styles.sidebar : styles.fullPanel,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
        ]}>
            {showPicker && !isDesktop ? (
                <NewConversationPicker
                    users={users}
                    loading={false}
                    onSelectUser={handlePickUser}
                    onClose={handlePickerClose}
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
                    onNewConversation={handleNewConversation}
                    selectedThreadId={selectedThread?.id}
                    showSearch
                />
            )}
        </View>
    );

    const chatPanel = selectedThread ? (
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
            hideBackButton={isDesktop}
            onDeleteMessage={handleDeleteMessage}
        />
    ) : null;

    const emptyChat = (
        <View style={[styles.emptyChat, { backgroundColor: colors.background }]}>
            <Feather name="message-circle" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>
                Выберите диалог или начните новый
            </Text>
        </View>
    );

    // Desktop: two-panel layout
    if (isDesktop) {
        return (
            <View style={[styles.desktopContainer, { backgroundColor: colors.background }]}>
                {seoBlock}
                <View style={[styles.desktopInner, { borderColor: colors.borderLight }]}>
                    {sidebar}
                    <View style={[styles.chatArea, { borderColor: colors.borderLight }]}>
                        {showPicker ? (
                            <NewConversationPicker
                                users={users}
                                loading={false}
                                onSelectUser={handlePickUser}
                                onClose={handlePickerClose}
                            />
                        ) : chatPanel ?? emptyChat}
                    </View>
                </View>
            </View>
        );
    }

    // Mobile: stacked layout
    return (
        <View style={[styles.mobileContainer, { backgroundColor: colors.background }]}>
            {seoBlock}
            {showPicker ? (
                <NewConversationPicker
                    users={users}
                    loading={false}
                    onSelectUser={handlePickUser}
                    onClose={handlePickerClose}
                />
            ) : selectedThread ? (
                chatPanel
            ) : (
                sidebar
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    mobileContainer: {
        flex: 1,
    },
    desktopContainer: {
        flex: 1,
        ...(Platform.OS === 'web'
            ? { minHeight: '70vh' as any, maxWidth: 1000, width: '100%', alignSelf: 'center' as any, paddingVertical: DESIGN_TOKENS.spacing.md }
            : {}),
    },
    desktopInner: {
        flex: 1,
        flexDirection: 'row',
        borderWidth: 1,
        borderRadius: DESIGN_TOKENS.radii.lg,
        overflow: 'hidden',
    },
    sidebar: {
        width: 320,
        borderRightWidth: 1,
    },
    fullPanel: {
        flex: 1,
    },
    chatArea: {
        flex: 1,
    },
    emptyChat: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: DESIGN_TOKENS.spacing.md,
    },
    emptyChatText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        textAlign: 'center',
    },
});
