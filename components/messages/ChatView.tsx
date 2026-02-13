import React, { memo, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Pressable,
    FlatList,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Image,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import MessageBubble from '@/components/messages/MessageBubble';
import type { Message } from '@/api/messages';

type ChatListItem =
    | { type: 'message'; data: Message }
    | { type: 'dateSeparator'; label: string; key: string };

function formatDateLabel(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
    if (isToday) return 'Сегодня';

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();
    if (isYesterday) return 'Вчера';

    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getDateKey(dateStr: string | null): string {
    if (!dateStr) return 'unknown';
    try {
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    } catch {
        return 'unknown';
    }
}

interface ChatViewProps {
    messages: Message[];
    loading: boolean;
    sending: boolean;
    currentUserId: string | null;
    otherUserName: string;
    otherUserAvatar?: string | null;
    otherUserId?: number | null;
    onSend: (text: string) => void;
    onBack: () => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
    hideBackButton?: boolean;
    onDeleteMessage?: (messageId: number) => void;
}

function ChatView({
    messages,
    loading,
    sending,
    currentUserId,
    otherUserName,
    otherUserAvatar,
    otherUserId,
    onSend,
    onBack,
    onLoadMore,
    hasMore,
    hideBackButton,
    onDeleteMessage,
}: ChatViewProps) {
    const colors = useThemedColors();
    const router = useRouter();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [text, setText] = useState('');
    const inputRef = useRef<TextInput>(null);
    const currentUserIdNum = currentUserId ? Number(currentUserId) : null;
    const SEND_COOLDOWN_MS = 300;
    const [sendCooldown, setSendCooldown] = useState(false);

    useEffect(() => {
        if (!sendCooldown) return;
        const timer = setTimeout(() => setSendCooldown(false), SEND_COOLDOWN_MS);
        return () => clearTimeout(timer);
    }, [sendCooldown]);

    const handleSend = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed || sendCooldown) return;
        setSendCooldown(true);
        onSend(trimmed);
        setText('');
    }, [text, onSend, sendCooldown]);

    const handleKeyPress = useCallback(
        (e: any) => {
            if (Platform.OS === 'web' && e.nativeEvent?.key === 'Enter' && !e.nativeEvent?.shiftKey) {
                e.preventDefault?.();
                handleSend();
            }
        },
        [handleSend]
    );

    const listItems = useMemo((): ChatListItem[] => {
        const sorted = [...(messages || [])].sort((a, b) => {
            const da = a.created_at ? new Date(a.created_at).getTime() : 0;
            const db = b.created_at ? new Date(b.created_at).getTime() : 0;
            return db - da;
        });

        const items: ChatListItem[] = [];

        for (let i = 0; i < sorted.length; i++) {
            const msg = sorted[i];
            items.push({ type: 'message', data: msg });

            const dk = getDateKey(msg.created_at);
            const nextDk = i + 1 < sorted.length ? getDateKey(sorted[i + 1].created_at) : null;
            if (dk !== nextDk) {
                items.push({
                    type: 'dateSeparator',
                    label: formatDateLabel(msg.created_at || ''),
                    key: `sep-${dk}`,
                });
            }
        }

        return items;
    }, [messages]);

    const renderItem = useCallback(
        ({ item }: { item: ChatListItem }) => {
            if (item.type === 'dateSeparator') {
                return (
                    <View style={styles.dateSeparator}>
                        <View style={[styles.dateSeparatorLine, { backgroundColor: colors.borderLight }]} />
                        <Text style={[styles.dateSeparatorText, { color: colors.textMuted }]}>
                            {item.label}
                        </Text>
                        <View style={[styles.dateSeparatorLine, { backgroundColor: colors.borderLight }]} />
                    </View>
                );
            }
            const msg = item.data;
            const isOwn = msg.sender === currentUserIdNum;
            return (
                <MessageBubble
                    message={msg}
                    isOwn={isOwn}
                    onDelete={isOwn && onDeleteMessage ? () => onDeleteMessage(msg.id) : undefined}
                />
            );
        },
        [currentUserIdNum, onDeleteMessage, styles, colors]
    );

    const keyExtractor = useCallback((item: ChatListItem) => {
        return item.type === 'dateSeparator' ? item.key : String(item.data.id);
    }, []);

    const canSend = text.trim().length > 0 && !sending && !sendCooldown;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                {!hideBackButton && (
                    <Pressable
                        onPress={onBack}
                        style={styles.backButton}
                        accessibilityRole="button"
                        accessibilityLabel="Назад к списку диалогов"
                    >
                        <Feather name="arrow-left" size={22} color={colors.text} />
                    </Pressable>
                )}
                <Pressable
                    onPress={otherUserId ? () => router.push(`/user/${otherUserId}` as any) : undefined}
                    disabled={!otherUserId}
                    style={styles.headerProfileLink}
                    accessibilityRole="link"
                    accessibilityLabel={`Профиль ${otherUserName}`}
                >
                    <View style={[styles.headerAvatar, { backgroundColor: colors.primarySoft }]}>
                        {otherUserAvatar ? (
                            <Image
                                source={{ uri: otherUserAvatar }}
                                style={styles.headerAvatarImage}
                            />
                        ) : (
                            <Feather name="user" size={18} color={colors.primary} />
                        )}
                    </View>
                    <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                        {otherUserName}
                    </Text>
                </Pressable>
            </View>

            {/* Messages */}
            {loading && messages.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={listItems}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    inverted
                    contentContainerStyle={styles.messagesList}
                    onEndReached={hasMore ? onLoadMore : undefined}
                    onEndReachedThreshold={0.3}
                    ListEmptyComponent={
                        <View style={styles.emptyChat}>
                            <Text style={[styles.emptyChatText, { color: colors.textMuted }]}>
                                Начните диалог — напишите сообщение
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Input */}
            <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                <TextInput
                    ref={inputRef}
                    style={[
                        styles.input,
                        {
                            backgroundColor: colors.backgroundSecondary,
                            color: colors.text,
                            borderColor: colors.borderLight,
                        },
                    ]}
                    value={text}
                    onChangeText={setText}
                    placeholder="Написать сообщение..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={2000}
                    onKeyPress={handleKeyPress}
                    accessibilityLabel="Поле ввода сообщения"
                />
                <Pressable
                    onPress={handleSend}
                    disabled={!canSend}
                    style={({ pressed }) => [
                        styles.sendButton,
                        { backgroundColor: canSend ? colors.primary : colors.backgroundSecondary },
                        pressed && canSend && { opacity: 0.85 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Отправить сообщение"
                >
                    {sending ? (
                        <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                        <Feather name="send" size={18} color={canSend ? colors.textInverse : colors.textMuted} />
                    )}
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const createStyles = (_colors: ThemedColors) =>
    StyleSheet.create({
        container: {
            flex: 1,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            paddingVertical: DESIGN_TOKENS.spacing.sm,
            borderBottomWidth: 1,
            minHeight: 56,
        },
        backButton: {
            padding: DESIGN_TOKENS.spacing.xs,
            marginRight: DESIGN_TOKENS.spacing.xs,
        },
        headerProfileLink: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
        },
        headerAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: DESIGN_TOKENS.spacing.sm,
            overflow: 'hidden',
        },
        headerAvatarImage: {
            width: 36,
            height: 36,
            borderRadius: 18,
        },
        headerTitle: {
            flex: 1,
            fontSize: DESIGN_TOKENS.typography.sizes.md,
            fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        },
        center: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        messagesList: {
            paddingVertical: DESIGN_TOKENS.spacing.sm,
        },
        emptyChat: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: DESIGN_TOKENS.spacing.xxl,
        },
        emptyChatText: {
            fontSize: DESIGN_TOKENS.typography.sizes.sm,
            textAlign: 'center',
        },
        inputContainer: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            paddingVertical: DESIGN_TOKENS.spacing.sm,
            borderTopWidth: 1,
            gap: DESIGN_TOKENS.spacing.xs,
        },
        input: {
            flex: 1,
            borderWidth: 1,
            borderRadius: DESIGN_TOKENS.radii.lg,
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            paddingVertical: DESIGN_TOKENS.spacing.sm,
            fontSize: DESIGN_TOKENS.typography.sizes.md,
            maxHeight: 120,
            minHeight: 42,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
        },
        sendButton: {
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: 'center',
            justifyContent: 'center',
        },
        dateSeparator: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: DESIGN_TOKENS.spacing.lg,
            paddingVertical: DESIGN_TOKENS.spacing.sm,
            gap: DESIGN_TOKENS.spacing.sm,
        },
        dateSeparatorLine: {
            flex: 1,
            height: 1,
        },
        dateSeparatorText: {
            fontSize: DESIGN_TOKENS.typography.sizes.xs,
            fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
        },
    });

export default memo(ChatView);
