import { memo, useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import type { Message } from '@/api/messages';
import ActionListSheet, { type ActionListSheetItem } from '@/components/ui/ActionListSheet';
import ContentSafetyActions from '@/components/safety/ContentSafetyActions';
import HiddenContentGate from '@/components/safety/HiddenContentGate';
import { makeContentRef } from '@/types/contentSafety';
import { confirmAction } from '@/utils/confirmAction';
import { formatMessageTimestamp } from '@/components/messages/messageTime';
import { translate as i18nT } from '@/i18n'


interface MessageBubbleProps {
    message: Message;
    isOwn: boolean;
    isSystem?: boolean;
    onDelete?: () => void;
}

function MessageBubble({ message, isOwn, isSystem, onDelete }: MessageBubbleProps) {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { width: windowWidth } = useWindowDimensions();
    const bubbleMaxWidth = Math.round(windowWidth * 0.75);
    const [menuOpen, setMenuOpen] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    // #2133 (Apple 1.2): чужое сообщение — «…» (пожаловаться / скрыть / заблокировать).
    const safetyRef = useMemo(
        () => (isOwn || isSystem ? null : makeContentRef('message', message.id, message.sender)),
        [isOwn, isSystem, message.id, message.sender],
    );

    const formattedTime = useMemo(() => formatMessageTimestamp(message.created_at), [message.created_at]);

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

    // #2127: меню долгого нажатия — общий ActionListSheet на всех платформах
    // (раньше на native — Alert с тремя кнопками, на web — строка кнопок).
    const handleLongPress = useCallback(() => {
        setMenuOpen(true);
    }, []);

    const handleDeletePress = useCallback(() => {
        setMenuOpen(false);
        if (!onDelete) return;

        // Web: подтверждение встроено в строку сообщения (своя вёрстка в ленте);
        // native: общий confirmAction (системный Alert).
        if (Platform.OS === 'web') {
            setShowDeleteConfirm(true);
            return;
        }

        void confirmAction({
            title: i18nT('messages:components.messages.MessageBubble.udalit_soobschenie_db3677e9'),
            message: i18nT('messages:components.messages.MessageBubble.vy_uvereny_chto_hotite_udalit_eto_soobscheni_85438546'),
            confirmText: i18nT('common:action.delete'),
            cancelText: i18nT('common:action.cancel'),
        }).then((confirmed) => {
            if (confirmed) onDelete();
        });
    }, [onDelete]);

    const menuActions = useMemo<ActionListSheetItem[]>(() => {
        const items: ActionListSheetItem[] = [
            {
                key: 'copy',
                label: i18nT('messages:components.messages.MessageBubble.kopirovat_649f5a88'),
                accessibilityLabel: i18nT('messages:components.messages.MessageBubble.kopirovat_tekst_3a304b34'),
                icon: 'copy',
                onPress: () => { void copyText(); },
            },
        ];
        if (onDelete) {
            items.push({
                key: 'delete',
                label: i18nT('common:action.delete'),
                accessibilityLabel: i18nT('messages:components.messages.MessageBubble.udalit_soobschenie_db3677e9'),
                icon: 'trash-2',
                destructive: true,
                onPress: handleDeletePress,
            });
        }
        return items;
    }, [copyText, handleDeletePress, onDelete]);

    const handleConfirmDelete = useCallback(() => {
        setShowDeleteConfirm(false);
        onDelete?.();
    }, [onDelete]);

    const handleCancelDelete = useCallback(() => {
        setShowDeleteConfirm(false);
    }, []);

    if (isSystem) {
        return (
            <View style={styles.systemContainer}>
                <View style={[styles.systemBubble, { backgroundColor: colors.backgroundSecondary }]}>
                    <Text style={[styles.systemText, { color: colors.textSecondary }]}>
                        {message.text + ' '}
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
            {/* Хвостовой пробел обязателен: RN New Architecture на Android меряет ширину текста
                на ~1 глиф короче отрисовки и обрезает последний символ у ужатого под текст баббла.
                Невидимый пробел поглощает обрезку. НЕ удалять (то же — на кнопках действий ниже). */}
            <Text
                style={[
                    styles.messageText,
                    { color: isOwn ? colors.textInverse : colors.text },
                ]}
                selectable
            >
                {message.text + ' '}
            </Text>
            {!!formattedTime && (
                <Text
                    style={[
                        styles.timeText,
                        { color: isOwn ? colors.textInverse : colors.textMuted, opacity: isOwn ? 0.7 : 1 },
                    ]}
                >
                    {formattedTime}
                </Text>
            )}
        </>
    );

    const body = (
        <View style={styles.container}>
            <View style={isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther}>
                <Pressable
                    testID="message-bubble-pressable"
                    onLongPress={handleLongPress}
                    delayLongPress={400}
                    style={[
                        styles.bubble,
                        { maxWidth: bubbleMaxWidth },
                        isOwn
                            ? [styles.bubbleOwn, { backgroundColor: colors.primary, borderColor: colors.primary }]
                            : [styles.bubbleOther, styles.bubbleOtherShrink, { backgroundColor: colors.surface, borderColor: colors.borderLight }],
                    ]}
                >
                    {bubbleContent}
                </Pressable>
                {safetyRef ? (
                    <ContentSafetyActions
                        contentRef={safetyRef}
                        testIDPrefix={`message-${message.id}-safety`}
                        style={styles.safetyTrigger}
                    />
                ) : null}
            </View>
            {onDelete && !showDeleteConfirm && (
                <View style={styles.inlineActionRow}>
                    <Pressable
                        onPress={handleDeletePress}
                        style={[styles.inlineActionButton, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                        accessibilityRole="button"
                        accessibilityLabel={i18nT('messages:components.messages.MessageBubble.udalit_soobschenie_db3677e9')}
                    >
                        <Feather name="trash-2" size={14} color={colors.textSecondary} />
                        <Text style={[styles.deleteActionText, { color: colors.textSecondary }]}>{i18nT('common:action.delete')}</Text>
                    </Pressable>
                </View>
            )}
            {showDeleteConfirm && (
                <View style={styles.actionsRow}>
                    <Pressable
                        onPress={handleConfirmDelete}
                        style={[styles.actionButton, { backgroundColor: colors.danger, borderColor: colors.danger }]}
                        accessibilityRole="button"
                        accessibilityLabel={i18nT('messages:components.messages.MessageBubble.podtverdit_udalenie_soobscheniya_7ffecfa5')}
                    >
                        <Feather name="trash-2" size={14} color={colors.textInverse} />
                        <Text style={[styles.deleteActionText, { color: colors.textInverse }]}>{i18nT('common:action.delete')}</Text>
                    </Pressable>
                    <Pressable
                        onPress={handleCancelDelete}
                        style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                        accessibilityRole="button"
                        accessibilityLabel={i18nT('messages:components.messages.MessageBubble.otmena_udaleniya_soobscheniya_5b6b0d34')}
                    >
                        <Text style={[styles.deleteActionText, { color: colors.textSecondary }]}>{i18nT('common:action.cancel')}</Text>
                    </Pressable>
                </View>
            )}
            <ActionListSheet
                visible={menuOpen}
                onClose={() => setMenuOpen(false)}
                title={i18nT('messages:components.messages.MessageBubble.soobschenie_bf2d70a6')}
                actions={menuActions}
            />
        </View>
    );

    if (isOwn) return body;

    return (
        <HiddenContentGate contentRef={safetyRef} style={styles.hiddenPlaceholder}>
            {body}
        </HiddenContentGate>
    );
}

const createStyles = (_colors: ThemedColors) =>
    StyleSheet.create({
        container: {
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            marginBottom: DESIGN_TOKENS.spacing.sm,
        },
        bubbleRowOwn: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
        },
        bubbleRowOther: {
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'flex-end',
        },
        // Баббл ужимается, чтобы «…» не уезжал за край узкой колонки чата (desktop split).
        bubbleOtherShrink: {
            flexShrink: 1,
        },
        safetyTrigger: {
            marginLeft: DESIGN_TOKENS.spacing.xxs,
        },
        hiddenPlaceholder: {
            marginHorizontal: DESIGN_TOKENS.spacing.md,
            marginBottom: DESIGN_TOKENS.spacing.sm,
        },
        bubble: {
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            paddingVertical: DESIGN_TOKENS.spacing.sm,
            borderRadius: DESIGN_TOKENS.radii.lg,
        },
        bubbleOwn: {
            borderBottomRightRadius: 4,
            borderWidth: 1,
        },
        bubbleOther: {
            borderBottomLeftRadius: 4,
            borderWidth: 1,
        },
        messageText: {
            fontSize: 15,
            lineHeight: 21,
            // Android/Fabric обрезает последний глиф, когда баббл ужимается ровно под ширину текста
            paddingRight: 4,
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
        inlineActionRow: {
            flexDirection: 'row',
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
        inlineActionButton: {
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
            // Android/Fabric обрезает последний глиф при точной ширине текста — буфер справа
            paddingRight: 3,
        },
    });

export default memo(MessageBubble);
