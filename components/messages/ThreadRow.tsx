import { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Platform, type AccessibilityActionEvent, type TextStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import IconButton from '@/components/ui/IconButton';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { webDataSetProps, webTitleRef } from '@/utils/webProps';
import { translate as i18nT, translatePlural } from '@/i18n';

const AVATAR_SIZE = 44;
const DELETE_ACTION_SIZE = 44;
const DELETE_A11Y_ACTION = 'delete';

/**
 * Маркеры для `app/global.css` (#2264): кнопка удаления видна только пока мышь над
 * строкой или фокус клавиатуры внутри неё, а колонка текста на это время отдаёт ей
 * место (`THREAD_ROW_ACTION_RESERVE` = padding-right в CSS). В покое имя занимает
 * всю ширину колонки.
 */
const ROW_MARKER = webDataSetProps({ threadRow: 'true' });
const TEXT_MARKER = webDataSetProps({ threadRowText: 'true' });
const ACTION_MARKER = webDataSetProps({ threadRowAction: 'true' });

interface ThreadRowProps {
    threadId: number;
    name: string;
    avatarUrl: string | null;
    time: string;
    unreadCount: number;
    selected: boolean;
    onPress: () => void;
    /** Запрос удаления: кнопка строки (web), долгое нажатие и действие скринридера (native). */
    onRequestDelete?: () => void;
    confirmingDelete: boolean;
    onConfirmDelete: () => void;
    onCancelDelete: () => void;
}

/**
 * Строка диалога (#2264). Имя собеседника — главный элемент: оно одно на первой
 * линии колонки текста и сжимается последним (`flexShrink` + `minWidth: 0` у
 * колонки, многоточие в конце). Дата и счётчик непрочитанных — на второй линии и
 * ширину у имени не берут; шеврона нет — выбранная строка подсвечена. Удаление не
 * стоит постоянной кнопкой в строке:
 *   - web: кнопка поверх правого края появляется по наведению и по фокусу
 *     клавиатуры (Tab), в DOM есть всегда — скринридер её видит;
 *   - native: долгое нажатие и действие доступности «Удалить диалог с …».
 */
function ThreadRow({
    threadId,
    name,
    avatarUrl,
    time,
    unreadCount,
    selected,
    onPress,
    onRequestDelete,
    confirmingDelete,
    onConfirmDelete,
    onCancelDelete,
}: ThreadRowProps) {
    const colors = useThemedColors();
    const hasUnread = unreadCount > 0;
    const deleteLabel = i18nT('messages:components.messages.ThreadList.udalit_dialog_s_value1_175bc2fd', { value1: name });
    const isWeb = Platform.OS === 'web';

    const nativeDeleteA11y = useMemo(
        () =>
            isWeb || !onRequestDelete
                ? null
                : {
                      accessibilityActions: [{ name: DELETE_A11Y_ACTION, label: deleteLabel }],
                      onAccessibilityAction: (event: AccessibilityActionEvent) => {
                          if (event.nativeEvent.actionName === DELETE_A11Y_ACTION) onRequestDelete();
                      },
                  },
        [isWeb, onRequestDelete, deleteLabel],
    );

    return (
        <View>
            <View
                testID={`thread-item-${threadId}`}
                style={[
                    styles.row,
                    isWeb ? styles.rowTooltipVisible : styles.rowClipped,
                    {
                        backgroundColor: selected ? colors.primarySoft : colors.surface,
                        borderColor: selected || hasUnread ? colors.primary : colors.borderLight,
                    },
                ]}
                {...ROW_MARKER}
            >
                <Pressable
                    style={({ pressed }) => [styles.main, pressed && styles.mainPressed]}
                    onPress={onPress}
                    onLongPress={onRequestDelete}
                    delayLongPress={500}
                    accessibilityRole="button"
                    accessibilityLabel={
                        hasUnread
                            ? translatePlural('messages:components.messages.ThreadList.dialog_s_value1_value2_neprochitannyh_62b679f3', unreadCount, { value1: name })
                            : i18nT('messages:components.messages.ThreadList.dialog_s_value1_0ed1fb8e', { value1: name })
                    }
                    {...nativeDeleteA11y}
                >
                    <View style={[styles.avatar, { backgroundColor: hasUnread ? colors.primary : colors.primarySoft }]}>
                        {avatarUrl ? (
                            <Image
                                source={{ uri: optimizeImageUrl(avatarUrl, { width: 88, quality: 70, fit: 'cover' }) ?? avatarUrl }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Feather name="user" size={20} color={hasUnread ? colors.textInverse : colors.primary} />
                        )}
                    </View>
                    <View style={styles.text} {...TEXT_MARKER}>
                        <Text
                            ref={webTitleRef(name)}
                            testID={`thread-name-${threadId}`}
                            style={[styles.name, { color: colors.text }, hasUnread && styles.nameUnread]}
                            numberOfLines={1}
                        >
                            {name}
                        </Text>
                        {(!!time || hasUnread) && (
                            <View style={styles.meta}>
                                <Text
                                    testID={`thread-time-${threadId}`}
                                    style={[styles.time, { color: hasUnread ? colors.primaryText : colors.textMuted }]}
                                    numberOfLines={1}
                                >
                                    {time}
                                </Text>
                                {hasUnread && (
                                    <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                                        <Text style={[styles.unreadBadgeText, { color: colors.textInverse }]}>
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                </Pressable>
                {isWeb && onRequestDelete && (
                    <View style={styles.action} {...ACTION_MARKER}>
                        <IconButton
                            icon={<Feather name="trash-2" size={16} color={colors.textSecondary} />}
                            label={deleteLabel}
                            size="sm"
                            style={styles.deleteButton}
                            onPress={onRequestDelete}
                            showTooltip
                            tooltipPlacement="left"
                        />
                    </View>
                )}
            </View>
            {confirmingDelete && (
                <View style={styles.deleteConfirmRow}>
                    <Pressable
                        onPress={onConfirmDelete}
                        style={[styles.deleteConfirmButton, { backgroundColor: colors.danger }]}
                        accessibilityRole="button"
                        accessibilityLabel={i18nT('messages:components.messages.ThreadList.podtverdit_udalenie_dialoga_e5fd0b3d')}
                    >
                        <Feather name="trash-2" size={14} color={colors.textInverse} />
                        <Text style={[styles.deleteConfirmText, { color: colors.textInverse }]}>
                            {i18nT('messages:components.messages.ThreadList.udalit_dialog_690a8668')}
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={onCancelDelete}
                        style={[
                            styles.deleteConfirmButton,
                            styles.deleteCancelButton,
                            { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={i18nT('messages:components.messages.ThreadList.otmena_c248c023')}
                    >
                        <Text style={[styles.deleteConfirmText, { color: colors.text }]}>
                            {i18nT('messages:components.messages.ThreadList.otmena_c248c023')}
                        </Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: DESIGN_TOKENS.spacing.sm,
        marginBottom: DESIGN_TOKENS.spacing.xxs,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
    },
    // Подсказка кнопки удаления рисуется за пределами строки (#1026): на web
    // обрезать её нельзя, на native обрезка держит скруглённый отклик нажатия.
    rowTooltipVisible: {
        overflow: 'visible',
    },
    rowClipped: {
        overflow: 'hidden',
    },
    main: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.sm,
        padding: DESIGN_TOKENS.spacing.xs,
    },
    mainPressed: {
        opacity: 0.85,
    },
    avatar: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
    },
    // Колонка текста забирает всё, что осталось после аватара; `minWidth: 0`
    // разрешает ей сжиматься, чтобы имя обрезалось многоточием, а не распирало строку.
    text: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    name: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: DESIGN_TOKENS.typography.weights.medium as TextStyle['fontWeight'],
    },
    nameUnread: {
        fontWeight: DESIGN_TOKENS.typography.weights.bold as TextStyle['fontWeight'],
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: DESIGN_TOKENS.spacing.xs,
        minHeight: 20,
    },
    time: {
        flexShrink: 1,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
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
        fontWeight: DESIGN_TOKENS.typography.weights.bold as TextStyle['fontWeight'],
    },
    action: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: DESIGN_TOKENS.spacing.xxs,
        justifyContent: 'center',
    },
    deleteButton: {
        width: DELETE_ACTION_SIZE,
        height: DELETE_ACTION_SIZE,
        minWidth: DELETE_ACTION_SIZE,
        minHeight: DELETE_ACTION_SIZE,
    },
    deleteConfirmRow: {
        flexDirection: 'row',
        gap: DESIGN_TOKENS.spacing.xs,
        marginHorizontal: DESIGN_TOKENS.spacing.sm,
        marginBottom: DESIGN_TOKENS.spacing.xs,
        paddingTop: DESIGN_TOKENS.spacing.xxs,
    },
    deleteConfirmButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xxs,
        minHeight: 44,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.sm,
    },
    deleteCancelButton: {
        borderWidth: 1,
    },
    deleteConfirmText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: DESIGN_TOKENS.typography.weights.medium as TextStyle['fontWeight'],
    },
});

export default memo(ThreadRow);
