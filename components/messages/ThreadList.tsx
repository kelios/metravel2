import React, { memo, useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Image, TextInput, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import type { MessageThread } from '@/api/messages';

interface ThreadListProps {
    threads: MessageThread[];
    loading: boolean;
    error: string | null;
    currentUserId: string | null;
    participantNames: Map<number, string>;
    participantAvatars: Map<number, string | null>;
    onSelectThread: (thread: MessageThread) => void;
    onRefresh: () => void;
    onNewConversation?: () => void;
    selectedThreadId?: number | null;
    showSearch?: boolean;
}

function ThreadList({
    threads,
    loading,
    error,
    currentUserId,
    participantNames,
    participantAvatars,
    onSelectThread,
    onRefresh,
    onNewConversation,
    selectedThreadId,
    showSearch,
}: ThreadListProps) {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const currentUserIdNum = currentUserId ? Number(currentUserId) : null;
    const [search, setSearch] = useState('');

    const getOtherParticipantId = useCallback(
        (thread: MessageThread): number | null => {
            return thread.participants.find((id) => id !== currentUserIdNum) ?? null;
        },
        [currentUserIdNum]
    );

    const getOtherParticipantName = useCallback(
        (thread: MessageThread) => {
            const otherId = getOtherParticipantId(thread);
            if (otherId != null && participantNames.has(otherId)) {
                return participantNames.get(otherId)!;
            }
            return 'Пользователь';
        },
        [getOtherParticipantId, participantNames]
    );

    const getOtherParticipantAvatar = useCallback(
        (thread: MessageThread): string | null => {
            const otherId = getOtherParticipantId(thread);
            if (otherId != null && participantAvatars.has(otherId)) {
                return participantAvatars.get(otherId) ?? null;
            }
            return null;
        },
        [getOtherParticipantId, participantAvatars]
    );

    const formatDate = useCallback((dateStr: string | null) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const isToday =
                date.getDate() === now.getDate() &&
                date.getMonth() === now.getMonth() &&
                date.getFullYear() === now.getFullYear();
            if (isToday) {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
        } catch {
            return '';
        }
    }, []);

    const filteredThreads = useMemo(() => {
        if (!search.trim()) return threads;
        const q = search.trim().toLowerCase();
        return threads.filter((t) => {
            const name = getOtherParticipantName(t).toLowerCase();
            return name.includes(q);
        });
    }, [threads, search, getOtherParticipantName]);

    const renderItem = useCallback(
        ({ item }: { item: MessageThread }) => {
            const name = getOtherParticipantName(item);
            const avatarUrl = getOtherParticipantAvatar(item);
            const time = formatDate(item.last_message_created_at);
            const isSelected = selectedThreadId != null && item.id === selectedThreadId;
            const unreadCount = item.unread_count ?? 0;
            const hasUnread = unreadCount > 0;
            return (
                <Pressable
                    style={({ pressed }) => [
                        styles.threadItem,
                        { backgroundColor: isSelected ? colors.primarySoft : colors.surface, borderColor: isSelected ? colors.primary : colors.borderLight },
                        hasUnread && !isSelected && { borderColor: colors.primary, borderWidth: 1.5 },
                        pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => onSelectThread(item)}
                    accessibilityRole="button"
                    accessibilityLabel={hasUnread ? `Диалог с ${name}, ${unreadCount} непрочитанных` : `Диалог с ${name}`}
                >
                    <View style={[styles.avatar, { backgroundColor: hasUnread ? colors.primary : colors.primarySoft }]}>
                        {avatarUrl ? (
                            <Image
                                source={{ uri: avatarUrl }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Feather name="user" size={20} color={hasUnread ? colors.textInverse : colors.primary} />
                        )}
                    </View>
                    <View style={styles.threadInfo}>
                        <View style={styles.threadNameRow}>
                            <Text style={[styles.threadName, { color: colors.text }, hasUnread && styles.threadNameUnread]} numberOfLines={1}>
                                {name}
                            </Text>
                            <View style={styles.threadTimeRow}>
                                {!!time && (
                                    <Text style={[styles.threadTime, { color: hasUnread ? colors.primary : colors.textMuted }]}>
                                        {time}
                                    </Text>
                                )}
                                {hasUnread && (
                                    <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                                        <Text style={[styles.unreadBadgeText, { color: colors.textInverse }]}>
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                    <Feather name="chevron-right" size={18} color={hasUnread ? colors.primary : colors.textMuted} />
                </Pressable>
            );
        },
        [colors, styles, getOtherParticipantName, getOtherParticipantAvatar, formatDate, onSelectThread, selectedThreadId]
    );

    const listHeader = useMemo(() => {
        if (!onNewConversation) return null;
        return (
            <Pressable
                style={({ pressed }) => [
                    styles.newConversationRow,
                    { backgroundColor: colors.surface, borderColor: colors.borderLight },
                    pressed && { opacity: 0.85 },
                ]}
                onPress={onNewConversation}
                accessibilityRole="button"
                accessibilityLabel="Новый диалог"
            >
                <View style={[styles.newConversationIcon, { backgroundColor: colors.primary }]}>
                    <Feather name="edit" size={18} color={colors.textInverse} />
                </View>
                <Text style={[styles.newConversationText, { color: colors.primary }]}>Новый диалог</Text>
            </Pressable>
        );
    }, [onNewConversation, colors, styles]);

    const searchBar = showSearch ? (
        <View style={[styles.searchContainer, { borderColor: colors.borderLight, backgroundColor: colors.backgroundSecondary }]}>
            <Feather name="search" size={16} color={colors.textMuted} />
            <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={search}
                onChangeText={setSearch}
                placeholder="Поиск..."
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Поиск диалогов"
            />
            {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} accessibilityLabel="Очистить поиск">
                    <Feather name="x" size={16} color={colors.textMuted} />
                </Pressable>
            )}
        </View>
    ) : null;

    if (loading && threads.length === 0) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Feather name="alert-circle" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{error}</Text>
                <Pressable
                    style={[styles.retryButton, { backgroundColor: colors.primary }]}
                    onPress={onRefresh}
                    accessibilityRole="button"
                    accessibilityLabel="Повторить"
                >
                    <Text style={styles.retryButtonText}>Повторить</Text>
                </Pressable>
            </View>
        );
    }

    if (threads.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                {searchBar}
                <View style={styles.center}>
                    <Feather name="message-circle" size={48} color={colors.textMuted} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>Нет сообщений</Text>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Напишите автору путешествия, чтобы начать диалог
                    </Text>
                    {onNewConversation && (
                        <Pressable
                            style={[styles.newConversationButton, { backgroundColor: colors.primary }]}
                            onPress={onNewConversation}
                            accessibilityRole="button"
                            accessibilityLabel="Новый диалог"
                        >
                            <Feather name="edit" size={16} color={colors.textInverse} />
                            <Text style={styles.newConversationButtonText}>Новый диалог</Text>
                        </Pressable>
                    )}
                </View>
            </View>
        );
    }

    const header = (
        <>
            {searchBar}
            {listHeader}
        </>
    );

    return (
        <FlatList
            data={filteredThreads}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshing={loading}
            onRefresh={onRefresh}
            ListHeaderComponent={header}
        />
    );
}

const createStyles = (colors: ThemedColors) =>
    StyleSheet.create({
        list: {
            paddingVertical: DESIGN_TOKENS.spacing.sm,
        },
        threadItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            paddingVertical: DESIGN_TOKENS.spacing.md,
            marginHorizontal: DESIGN_TOKENS.spacing.md,
            marginBottom: DESIGN_TOKENS.spacing.xs,
            borderRadius: DESIGN_TOKENS.radii.md,
            borderWidth: 1,
        },
        avatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: DESIGN_TOKENS.spacing.sm,
            overflow: 'hidden',
        },
        avatarImage: {
            width: 44,
            height: 44,
            borderRadius: 22,
        },
        threadInfo: {
            flex: 1,
            marginRight: DESIGN_TOKENS.spacing.xs,
        },
        threadNameRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        threadName: {
            fontSize: DESIGN_TOKENS.typography.sizes.md,
            fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
            flex: 1,
        },
        threadTime: {
            fontSize: DESIGN_TOKENS.typography.sizes.xs,
            marginLeft: DESIGN_TOKENS.spacing.xs,
        },
        threadTimeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: DESIGN_TOKENS.spacing.xs,
        },
        threadNameUnread: {
            fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
        },
        unreadBadge: {
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 6,
        },
        unreadBadgeText: {
            fontSize: 11,
            fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
        },
        center: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: DESIGN_TOKENS.spacing.xl,
            paddingVertical: DESIGN_TOKENS.spacing.xxl,
        },
        emptyTitle: {
            fontSize: DESIGN_TOKENS.typography.sizes.lg,
            fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
            marginTop: DESIGN_TOKENS.spacing.md,
            textAlign: 'center',
        },
        emptyText: {
            fontSize: DESIGN_TOKENS.typography.sizes.sm,
            marginTop: DESIGN_TOKENS.spacing.xs,
            textAlign: 'center',
            lineHeight: 20,
        },
        retryButton: {
            marginTop: DESIGN_TOKENS.spacing.md,
            paddingHorizontal: DESIGN_TOKENS.spacing.lg,
            paddingVertical: DESIGN_TOKENS.spacing.sm,
            borderRadius: DESIGN_TOKENS.radii.md,
        },
        retryButtonText: {
            color: colors.textInverse,
            fontSize: DESIGN_TOKENS.typography.sizes.sm,
            fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        },
        newConversationButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: DESIGN_TOKENS.spacing.xs,
            marginTop: DESIGN_TOKENS.spacing.lg,
            paddingHorizontal: DESIGN_TOKENS.spacing.lg,
            paddingVertical: DESIGN_TOKENS.spacing.sm,
            borderRadius: DESIGN_TOKENS.radii.md,
        },
        newConversationButtonText: {
            color: colors.textInverse,
            fontSize: DESIGN_TOKENS.typography.sizes.sm,
            fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        },
        newConversationRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            paddingVertical: DESIGN_TOKENS.spacing.md,
            marginHorizontal: DESIGN_TOKENS.spacing.md,
            marginBottom: DESIGN_TOKENS.spacing.sm,
            borderRadius: DESIGN_TOKENS.radii.md,
            borderWidth: 1,
        },
        newConversationIcon: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: DESIGN_TOKENS.spacing.sm,
        },
        newConversationText: {
            fontSize: DESIGN_TOKENS.typography.sizes.md,
            fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        },
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: DESIGN_TOKENS.spacing.md,
            marginTop: DESIGN_TOKENS.spacing.sm,
            marginBottom: DESIGN_TOKENS.spacing.xs,
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            paddingVertical: DESIGN_TOKENS.spacing.xs,
            borderWidth: 1,
            borderRadius: DESIGN_TOKENS.radii.lg,
            gap: DESIGN_TOKENS.spacing.xs,
        },
        searchInput: {
            flex: 1,
            fontSize: DESIGN_TOKENS.typography.sizes.sm,
            paddingVertical: DESIGN_TOKENS.spacing.xs,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
        },
    });

export default memo(ThreadList);
