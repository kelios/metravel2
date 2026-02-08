import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
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
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import MessageBubble from '@/components/messages/MessageBubble';
import type { Message } from '@/api/messages';

interface ChatViewProps {
    messages: Message[];
    loading: boolean;
    sending: boolean;
    currentUserId: string | null;
    otherUserName: string;
    otherUserAvatar?: string | null;
    onSend: (text: string) => void;
    onBack: () => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
    hideBackButton?: boolean;
}

function ChatView({
    messages,
    loading,
    sending,
    currentUserId,
    otherUserName,
    otherUserAvatar,
    onSend,
    onBack,
    onLoadMore,
    hasMore,
    hideBackButton,
}: ChatViewProps) {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [text, setText] = useState('');
    const inputRef = useRef<TextInput>(null);
    const currentUserIdNum = currentUserId ? Number(currentUserId) : null;

    const handleSend = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed) return;
        onSend(trimmed);
        setText('');
    }, [text, onSend]);

    const handleKeyPress = useCallback(
        (e: any) => {
            if (Platform.OS === 'web' && e.nativeEvent?.key === 'Enter' && !e.nativeEvent?.shiftKey) {
                e.preventDefault?.();
                handleSend();
            }
        },
        [handleSend]
    );

    const sortedMessages = useMemo(() => {
        return [...messages].sort((a, b) => {
            const da = a.created_at ? new Date(a.created_at).getTime() : 0;
            const db = b.created_at ? new Date(b.created_at).getTime() : 0;
            return db - da;
        });
    }, [messages]);

    const renderItem = useCallback(
        ({ item }: { item: Message }) => {
            const isOwn = item.sender === currentUserIdNum;
            return <MessageBubble message={item} isOwn={isOwn} />;
        },
        [currentUserIdNum]
    );

    const canSend = text.trim().length > 0 && !sending;

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
            </View>

            {/* Messages */}
            {loading && messages.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={sortedMessages}
                    keyExtractor={(item) => String(item.id)}
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
                        <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                        <Feather name="send" size={18} color={canSend ? '#ffffff' : colors.textMuted} />
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
            transform: [{ scaleY: -1 }],
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
    });

export default memo(ChatView);
