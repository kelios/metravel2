import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Image } from 'react-native';
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
}: ThreadListProps) {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const currentUserIdNum = currentUserId ? Number(currentUserId) : null;

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

    const renderItem = useCallback(
        ({ item }: { item: MessageThread }) => {
            const name = getOtherParticipantName(item);
            const avatarUrl = getOtherParticipantAvatar(item);
            const time = formatDate(item.last_message_created_at);
            return (
                <Pressable
                    style={({ pressed }) => [
                        styles.threadItem,
                        { backgroundColor: colors.surface, borderColor: colors.borderLight },
                        pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => onSelectThread(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Диалог с ${name}`}
                >
                    <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                        {avatarUrl ? (
                            <Image
                                source={{ uri: avatarUrl }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Feather name="user" size={20} color={colors.primary} />
                        )}
                    </View>
                    <View style={styles.threadInfo}>
                        <Text style={[styles.threadName, { color: colors.text }]} numberOfLines={1}>
                            {name}
                        </Text>
                        {!!time && (
                            <Text style={[styles.threadTime, { color: colors.textMuted }]}>
                                {time}
                            </Text>
                        )}
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </Pressable>
            );
        },
        [colors, styles, getOtherParticipantName, getOtherParticipantAvatar, formatDate, onSelectThread]
    );

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
            <View style={styles.center}>
                <Feather name="message-circle" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Нет сообщений</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Напишите автору путешествия, чтобы начать диалог
                </Text>
            </View>
        );
    }

    return (
        <FlatList
            data={threads}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshing={loading}
            onRefresh={onRefresh}
        />
    );
}

const createStyles = (_colors: ThemedColors) =>
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
        threadName: {
            fontSize: DESIGN_TOKENS.typography.sizes.md,
            fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        },
        threadTime: {
            fontSize: DESIGN_TOKENS.typography.sizes.xs,
            marginTop: 2,
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
            color: '#ffffff',
            fontSize: DESIGN_TOKENS.typography.sizes.sm,
            fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        },
    });

export default memo(ThreadList);
