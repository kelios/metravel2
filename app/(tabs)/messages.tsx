import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { buildLoginHref } from '@/utils/authNavigation';
import { useThreads, useThreadMessages, useSendMessage, useDeleteMessage, useDeleteThread, useAvailableUsers, useMarkThreadRead } from '@/hooks/useMessages';
import {
    collectLegacyPeerIds,
    collectParticipantPreviews,
    fetchThreadByUser,
    getMessagingUserDisplayName,
    getMessagingUserId,
    isOrphanedMessageThread,
} from '@/api/messages';
import { fetchUserProfile, resolveProfileFullName } from '@/api/user';
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
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { useWebHydrationGate } from '@/hooks/useWebHydrationGate';
import { translate as i18nT } from '@/i18n'


const InstantSEO = React.lazy(() => import('@/components/seo/LazyInstantSEO'));

function MessagesHydrationFallback() {
    // Видимый лоадер вместо пустого экрана: при переходе с профиля тап должен сразу
    // читаться как «загружается», а не как «ничего не произошло».
    return (
        <View style={[styles.mobileContainer, styles.hydrationFallback]}>
            <ActivityIndicator />
        </View>
    );
}

export default function MessagesScreen() {
    const hydrationReady = useWebHydrationGate();

    if (!hydrationReady) {
        return <MessagesHydrationFallback />;
    }

    return <MessagesScreenContent />;
}

function MessagesScreenContent() {
    const router = useRouter();
    const isFocused = useIsFocused();
    const { isAuthenticated, authReady, userId } = useAuth();
    const colors = useThemedColors();
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const isDesktop = Platform.OS === 'web' && !isMobile;
    const params = useLocalSearchParams<{ userId?: string | string[]; user_id?: string | string[]; threadId?: string | string[] }>();

    const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
    const [initialLoading, setInitialLoading] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const userDismissedDeepLink = useRef(false);
    const handledUserDeepLink = useRef<string | null>(null);
    const pendingUserDeepLink = useRef<string | null>(null);
    const handledThreadDeepLink = useRef<string | null>(null);

    const targetUserIdParam = useMemo(() => {
        const raw = params.userId ?? params.user_id;
        return Array.isArray(raw) ? raw[0] : raw;
    }, [params.userId, params.user_id]);
    const targetThreadIdParam = useMemo(() => {
        const raw = params.threadId;
        return Array.isArray(raw) ? raw[0] : raw;
    }, [params.threadId]);
    const messagesAuthRedirect = useMemo(() => {
        if (!targetUserIdParam) return '/messages';
        return `/messages?userId=${encodeURIComponent(targetUserIdParam)}`;
    }, [targetUserIdParam]);

    const canFetch = authReady && isAuthenticated;
    const {
        threads,
        loading: threadsLoading,
        error: threadsError,
        refresh: refreshThreads,
        setThreadUnreadCount,
        optimisticRemove: optimisticRemoveThread,
    } = useThreads(canFetch, isFocused);
    const { messages, loading: messagesLoading, refresh: refreshMessages, hasMore, loadMore, optimisticRemove } = useThreadMessages(
        selectedThread?.id ?? null, isFocused
    );
    const { send, sending } = useSendMessage();
    const { remove: removeMessage } = useDeleteMessage();
    const { remove: removeThread } = useDeleteThread();
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

    // #708: канонический источник имён/аватаров — participant_previews из payload
    // /message-threads/. Покрывает и список диалогов, и шапку открытого чата.
    const previewPeers = useMemo(
        () => collectParticipantPreviews([...threads, selectedThread]),
        [threads, selectedThread],
    );

    // Fallback для старого API без participant_previews: peers часто отсутствуют в
    // available-users, поэтому без резолва профилей список и шапка показывали бы
    // генерик «Пользователь». На каноническом payload previews этот путь не даёт
    // ни одного fetchUserProfile-запроса (N+1 убран).
    const [resolvedPeers, setResolvedPeers] = useState<
        Map<number, { name: string; avatar: string | null }>
    >(() => new Map());

    const peerIdsToResolve = useMemo(() => {
        const ids = new Set<number>(collectLegacyPeerIds(threads, Number(userId)));
        if (otherUserId != null) ids.add(otherUserId);
        return Array.from(ids).filter(
            (id) => !previewPeers.has(id) && !participantNames.has(id) && !resolvedPeers.has(id),
        );
    }, [threads, otherUserId, userId, previewPeers, participantNames, resolvedPeers]);

    useEffect(() => {
        if (peerIdsToResolve.length === 0) return;
        let cancelled = false;
        void Promise.all(
            peerIdsToResolve.map(async (id) => {
                try {
                    const p = await fetchUserProfile(id);
                    const name = resolveProfileFullName(p);
                    return [id, { name, avatar: p.avatar ?? null }] as const;
                } catch {
                    return null;
                }
            }),
        ).then((entries) => {
            if (cancelled) return;
            const valid = entries.filter(Boolean) as Array<
                readonly [number, { name: string; avatar: string | null }]
            >;
            if (valid.length === 0) return;
            setResolvedPeers((prev) => {
                const next = new Map(prev);
                for (const [id, info] of valid) next.set(id, info);
                return next;
            });
        });
        return () => {
            cancelled = true;
        };
    }, [peerIdsToResolve]);

    // Names/avatars enriched with resolved peer profiles — used by BOTH the thread
    // list and the open chat header so neither shows the generic «Пользователь».
    // participant_previews (#708) — канонический источник, перекрывает остальные.
    const mergedNames = useMemo(() => {
        const map = new Map(participantNames);
        for (const [id, info] of resolvedPeers) {
            if (info.name && !map.has(id)) map.set(id, info.name);
        }
        for (const [id, info] of previewPeers) {
            if (info.name) map.set(id, info.name);
        }
        return map;
    }, [participantNames, resolvedPeers, previewPeers]);

    const mergedAvatars = useMemo(() => {
        const map = new Map(participantAvatars);
        for (const [id, info] of resolvedPeers) {
            if (!map.has(id)) map.set(id, info.avatar);
        }
        for (const [id, info] of previewPeers) {
            if (info.avatar || !map.has(id)) map.set(id, info.avatar);
        }
        return map;
    }, [participantAvatars, resolvedPeers, previewPeers]);

    const otherUserName = useMemo(() => {
        if (otherUserId != null && mergedNames.has(otherUserId)) {
            return mergedNames.get(otherUserId)!;
        }
        if (isOrphanedMessageThread(selectedThread, Number(userId))) {
            return i18nT('errorsStatic:api.messages.deletedUser');
        }
        return i18nT('messages:app.tabs.messages.polzovatel_3baf520c');
    }, [otherUserId, mergedNames, selectedThread, userId]);

    const otherUserAvatar = useMemo(() => {
        if (otherUserId != null && mergedAvatars.has(otherUserId)) {
            return mergedAvatars.get(otherUserId) ?? null;
        }
        return null;
    }, [otherUserId, mergedAvatars]);

    // Диплинк: открыть диалог с конкретным пользователем
    useEffect(() => {
        if (!targetUserIdParam || !isAuthenticated || !authReady) return;
        if (userDismissedDeepLink.current) return;
        // Обрабатываем диплинк один раз на значение userId — иначе эффект
        // перезапускается на каждый poll threads и переоткрывает диалог.
        if (handledUserDeepLink.current === targetUserIdParam) return;
        if (pendingUserDeepLink.current === targetUserIdParam) return;
        const targetUserId = Number(targetUserIdParam);
        if (isNaN(targetUserId)) return;

        let cancelled = false;
        pendingUserDeepLink.current = targetUserIdParam;
        // Opening a chat with a specific user (e.g. «Написать автору») must show the
        // conversation, not a leftover «Новый диалог» recipient picker.
        setShowPicker(false);
        setInitialLoading(true);

        (async () => {
            try {
                const res = await fetchThreadByUser(targetUserId);
                if (cancelled) return;

                if (res.thread_id != null) {
                    const existing = threads.find((t) => t.id === res.thread_id);
                    if (res.thread || existing) {
                        setSelectedThread(res.thread ?? existing ?? null);
                    } else {
                        setSelectedThread({
                            id: res.thread_id,
                            participants: [Number(userId), targetUserId],
                            created_at: null,
                            last_message_created_at: null,
                            unread_count: 0,
                        });
                    }
                } else {
                    // No existing thread — create a virtual one for sending
                    setSelectedThread({
                        id: -1,
                        participants: [Number(userId), targetUserId],
                        created_at: null,
                        last_message_created_at: null,
                        unread_count: 0,
                    });
                }
                handledUserDeepLink.current = targetUserIdParam;
            } catch (e) {
                devError('MessagesScreen: fetchThreadByUser error:', e);
                // Still open a virtual thread so user can send
                setSelectedThread({
                    id: -1,
                    participants: [Number(userId), targetUserId],
                    created_at: null,
                    last_message_created_at: null,
                    unread_count: 0,
                });
                handledUserDeepLink.current = targetUserIdParam;
            } finally {
                if (pendingUserDeepLink.current === targetUserIdParam) {
                    pendingUserDeepLink.current = null;
                }
                if (!cancelled) setInitialLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            if (pendingUserDeepLink.current === targetUserIdParam) {
                pendingUserDeepLink.current = null;
            }
        };
    }, [targetUserIdParam, isAuthenticated, authReady, userId, threads]);

    // Диплинк: открыть конкретный диалог по ID
    useEffect(() => {
        if (!targetThreadIdParam || !isAuthenticated || !authReady) return;
        // Один раз на значение threadId. Ждём, пока threads загрузятся (тогда find
        // найдёт диалог), но не зацикливаем refreshThreads → новый threads → refresh.
        if (handledThreadDeepLink.current === targetThreadIdParam) return;
        const tid = Number(targetThreadIdParam);
        if (isNaN(tid)) return;
        const found = threads.find((t) => t.id === tid);
        if (found) {
            handledThreadDeepLink.current = targetThreadIdParam;
            setSelectedThread(found);
            if (found.id >= 0) {
                setThreadUnreadCount(found.id, 0);
                markRead(found.id);
                refreshThreads();
            }
        }
    }, [targetThreadIdParam, isAuthenticated, authReady, threads, markRead, refreshThreads, setThreadUnreadCount]);

    const handleSelectThread = useCallback((thread: MessageThread) => {
        setSelectedThread(thread);
        if (thread.id >= 0) {
            setThreadUnreadCount(thread.id, 0);
            markRead(thread.id);
            refreshThreads();
        }
    }, [markRead, refreshThreads, setThreadUnreadCount]);

    const handleBack = useCallback(() => {
        userDismissedDeepLink.current = true;
        setSelectedThread(null);
        refreshThreads();
    }, [refreshThreads]);

    const handleNewConversation = useCallback(() => {
        setShowPicker(true);
    }, []);

    const handlePickerClose = useCallback(() => {
        setShowPicker(false);
    }, []);

    // Android: hardware Back сначала закрывает открытый picker/тред (как кнопка
    // «назад» внутри экрана), и только если ничего не открыто — возвращает на
    // предыдущий экран (Профиль). На web/iOS хук — no-op (гейт по Platform.OS).
    useAndroidBackHandler(
        useCallback(() => {
            if (showPicker) {
                handlePickerClose();
                return true;
            }
            if (selectedThread) {
                handleBack();
                return true;
            }
            return false;
        }, [showPicker, selectedThread, handlePickerClose, handleBack])
    );

    const handlePickUser = useCallback(
        async (targetUserId: number) => {
            setShowPicker(false);
            if (!userId) return;

            try {
                const res = await fetchThreadByUser(targetUserId);
                if (res.thread_id != null) {
                    const existing = threads.find((t) => t.id === res.thread_id);
                    if (res.thread || existing) {
                        setSelectedThread(res.thread ?? existing ?? null);
                    } else {
                        setSelectedThread({
                            id: res.thread_id,
                            participants: [Number(userId), targetUserId],
                            created_at: null,
                            last_message_created_at: null,
                            unread_count: 0,
                        });
                    }
                } else {
                    setSelectedThread({
                        id: -1,
                        participants: [Number(userId), targetUserId],
                        created_at: null,
                        last_message_created_at: null,
                        unread_count: 0,
                    });
                }
            } catch (e) {
                devError('handlePickUser error:', e);
                setSelectedThread({
                    id: -1,
                    participants: [Number(userId), targetUserId],
                    created_at: null,
                    last_message_created_at: null,
                    unread_count: 0,
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
                if (selectedThread.id === -1) {
                    // Virtual thread: resolve to the real thread created by the backend
                    const otherUid = otherIds[0] ?? selectedThread.participants[0];
                    try {
                        const res = await fetchThreadByUser(otherUid);
                        if (res.thread_id != null) {
                            setSelectedThread({
                                id: res.thread_id,
                                participants: selectedThread.participants,
                                created_at: null,
                                last_message_created_at: null,
                                unread_count: 0,
                            });
                        }
                    } catch (e) {
                        devError('handleSend: fetchThreadByUser error:', e);
                    }
                    refreshThreads();
                } else {
                    refreshMessages();
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

    const handleDeleteThread = useCallback(
        async (threadId: number) => {
            const deletedSelectedThread = selectedThread?.id === threadId ? selectedThread : null;
            const rollback = optimisticRemoveThread(threadId);
            if (deletedSelectedThread) {
                setSelectedThread(null);
            }

            const ok = await removeThread(threadId);
            if (!ok) {
                rollback();
                if (deletedSelectedThread) {
                    setSelectedThread((current) => current ?? deletedSelectedThread);
                }
            }
        },
        [removeThread, selectedThread, optimisticRemoveThread]
    );

    // Пользователь не авторизован
    if (authReady && !isAuthenticated) {
        return (
            <View style={[styles.mobileContainer, { backgroundColor: colors.background }]}>
                {isFocused && (
                    <React.Suspense fallback={null}>
                        <InstantSEO
                            headKey="messages"
                            title={i18nT('messages:app.tabs.messages.soobscheniya_metravel_ccba5f8b')}
                            description={i18nT('messages:app.tabs.messages.lichnye_soobscheniya_18511fc1')}
                            canonical={buildCanonicalUrl('/messages')}
                            robots="noindex,nofollow"
                        />
                    </React.Suspense>
                )}
                <EmptyState
                    icon="log-in"
                    title={i18nT('messages:app.tabs.messages.voydite_v_akkaunt_4c68ac56')}
                    description={i18nT('messages:app.tabs.messages.dlya_dostupa_k_soobscheniyam_neobhodimo_avto_df1d2208')}
                    action={{
                        label: i18nT('messages:app.tabs.messages.voyti_9426b865'),
                        onPress: () => router.push(buildLoginHref({ redirect: messagesAuthRedirect }) as any),
                    }}
                />
            </View>
        );
    }

    const seoBlock = isFocused ? (
        <React.Suspense fallback={null}>
            <InstantSEO
                headKey="messages"
                title={i18nT('messages:app.tabs.messages.soobscheniya_metravel_ccba5f8b')}
                description={i18nT('messages:app.tabs.messages.lichnye_soobscheniya_18511fc1')}
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
                    participantNames={mergedNames}
                    participantAvatars={mergedAvatars}
                    onSelectThread={handleSelectThread}
                    onRefresh={refreshThreads}
                    onNewConversation={handleNewConversation}
                    onDeleteThread={handleDeleteThread}
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
            otherUserId={otherUserId}
            onSend={handleSend}
            onBack={handleBack}
            onLoadMore={loadMore}
            hasMore={hasMore}
            hideBackButton={isDesktop}
            onDeleteMessage={handleDeleteMessage}
            onDeleteThread={selectedThread.id >= 0 ? () => handleDeleteThread(selectedThread.id) : undefined}
            reserveBottomDock={false}
        />
    ) : null;

    const emptyChat = (
        <View style={[styles.emptyChat, { backgroundColor: colors.background }]}>
            <Feather name="message-circle" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>
                {i18nT('messages:app.tabs.messages.vyberite_dialog_ili_nachnite_novyy_0cc840a3')}</Text>
        </View>
    );

    // Desktop: двухпанельный интерфейс
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

    // Mobile: стековая компоновка
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
    hydrationFallback: {
        alignItems: 'center',
        justifyContent: 'center',
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
