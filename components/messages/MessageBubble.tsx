import React, { memo, useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, Alert } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import type { Message } from '@/api/messages';

interface MessageBubbleProps {
    message: Message;
    isOwn: boolean;
    isSystem?: boolean;
    onDelete?: () => void;
}

function MessageBubble({ message, isOwn, isSystem, onDelete }: MessageBubbleProps) {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const formattedTime = useMemo(() => {
        if (!message.created_at) return '';
        try {
            const date = new Date(message.created_at);
            const now = new Date();
            const isToday =
                date.getDate() === now.getDate() &&
                date.getMonth() === now.getMonth() &&
                date.getFullYear() === now.getFullYear();

            const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (isToday) return time;

            const dateStr = date.toLocaleDateString([], { day: 'numeric', month: 'short' });
            return `${dateStr}, ${time}`;
        } catch {
            return '';
        }
    }, [message.created_at]);

    const [showActions, setShowActions] = useState(false);

    const copyText = useCallback(async () => {
        try {
            if (Platform.OS === 'web' && (navigator as any)?.clipboard) {
                await (navigator as any).clipboard.writeText(message.text);
            } else {
                await Clipboard.setStringAsync(message.text);
            }
        } catch {
            // ignore clipboard failures
        }
    }, [message.text]);

    const handleLongPress = useCallback(() => {
        if (Platform.OS === 'web') {
            setShowActions((prev) => !prev);
        } else {
            const buttons: any[] = [
                { text: 'Копировать', onPress: copyText },
            ];
            if (onDelete) {
                buttons.push({ text: 'Удалить', style: 'destructive', onPress: onDelete });
            }
            buttons.push({ text: 'Отмена', style: 'cancel' });
            Alert.alert('Сообщение', undefined, buttons);
        }
    }, [onDelete, copyText]);

    const handleDeletePress = useCallback(() => {
        setShowActions(false);
        onDelete?.();
    }, [onDelete]);

    if (isSystem) {
        return (
            <View style={styles.systemContainer}>
                <View style={[styles.systemBubble, { backgroundColor: colors.backgroundSecondary }]}>
                    <Text style={[styles.systemText, { color: colors.textSecondary }]}>
                        {message.text}
                    </Text>
                    {!!formattedTime && (
                        <Text style={[styles.timeText, styles.systemTimeText, { color: colors.textMuted }]}>
                            {formattedTime}
                        </Text>
                    )}
                </View>
            </View>
        );
    }

    const bubbleContent = (
        <>
            <Text
                style={[
                    styles.messageText,
                    { color: isOwn ? '#ffffff' : colors.text },
                ]}
                selectable
            >
                {message.text}
            </Text>
            {!!formattedTime && (
                <Text
                    style={[
                        styles.timeText,
                        { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textMuted },
                    ]}
                >
                    {formattedTime}
                </Text>
            )}
        </>
    );

    return (
        <View style={[styles.container, isOwn ? styles.containerOwn : styles.containerOther]}>
            <Pressable
                testID="message-bubble-pressable"
                onLongPress={handleLongPress}
                delayLongPress={400}
                style={[
                    styles.bubble,
                    isOwn
                        ? [styles.bubbleOwn, { backgroundColor: colors.primary }]
                        : [styles.bubbleOther, { backgroundColor: colors.surface, borderColor: colors.borderLight }],
                ]}
            >
                {bubbleContent}
            </Pressable>
            {showActions && (
                <View style={styles.actionsRow}>
                    <Pressable
                        onPress={() => { setShowActions(false); copyText(); }}
                        style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                        accessibilityRole="button"
                        accessibilityLabel="Копировать текст"
                    >
                        <Feather name="copy" size={14} color={colors.textSecondary} />
                        <Text style={[styles.deleteActionText, { color: colors.textSecondary }]}>Копировать</Text>
                    </Pressable>
                    {onDelete && (
                        <Pressable
                            onPress={handleDeletePress}
                            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                            accessibilityRole="button"
                            accessibilityLabel="Удалить сообщение"
                        >
                            <Feather name="trash-2" size={14} color={colors.textSecondary} />
                            <Text style={[styles.deleteActionText, { color: colors.textSecondary }]}>Удалить</Text>
                        </Pressable>
                    )}
                </View>
            )}
        </View>
    );
}

const createStyles = (_colors: ThemedColors) =>
    StyleSheet.create({
        container: {
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            marginBottom: DESIGN_TOKENS.spacing.xs,
        },
        containerOwn: {
            alignItems: 'flex-end',
        },
        containerOther: {
            alignItems: 'flex-start',
        },
        bubble: {
            maxWidth: '75%' as any,
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            paddingVertical: DESIGN_TOKENS.spacing.sm,
            borderRadius: DESIGN_TOKENS.radii.lg,
        },
        bubbleOwn: {
            borderBottomRightRadius: 4,
        },
        bubbleOther: {
            borderBottomLeftRadius: 4,
            borderWidth: 1,
        },
        messageText: {
            fontSize: 15,
            lineHeight: 21,
            ...(Platform.OS === 'web' ? { wordBreak: 'break-word' as any } : {}),
        },
        timeText: {
            fontSize: 11,
            marginTop: 4,
            textAlign: 'right',
        },
        systemContainer: {
            alignItems: 'center',
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            marginVertical: DESIGN_TOKENS.spacing.sm,
        },
        systemBubble: {
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            paddingVertical: DESIGN_TOKENS.spacing.sm,
            borderRadius: DESIGN_TOKENS.radii.md,
            maxWidth: '85%' as any,
        },
        systemText: {
            fontSize: 13,
            lineHeight: 18,
            textAlign: 'center',
            fontStyle: 'italic',
        },
        systemTimeText: {
            textAlign: 'center',
        },
        actionsRow: {
            flexDirection: 'row',
            gap: DESIGN_TOKENS.spacing.xs,
            marginTop: 4,
            alignSelf: 'flex-end',
        },
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: DESIGN_TOKENS.spacing.sm,
            paddingVertical: DESIGN_TOKENS.spacing.xs,
            borderRadius: DESIGN_TOKENS.radii.sm,
            borderWidth: 1,
        },
        deleteActionText: {
            fontSize: 12,
        },
    });

export default memo(MessageBubble);
