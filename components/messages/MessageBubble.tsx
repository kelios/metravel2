import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import type { Message } from '@/api/messages';

interface MessageBubbleProps {
    message: Message;
    isOwn: boolean;
    isSystem?: boolean;
}

function MessageBubble({ message, isOwn, isSystem }: MessageBubbleProps) {
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

    return (
        <View style={[styles.container, isOwn ? styles.containerOwn : styles.containerOther]}>
            <View
                style={[
                    styles.bubble,
                    isOwn
                        ? [styles.bubbleOwn, { backgroundColor: colors.primary }]
                        : [styles.bubbleOther, { backgroundColor: colors.surface, borderColor: colors.borderLight }],
                ]}
            >
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
            </View>
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
    });

export default memo(MessageBubble);
