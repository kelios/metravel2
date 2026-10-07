import { searchInputAccessibilityProps } from '@/utils/webProps'
import { memo, useCallback, useMemo, useState, type ReactElement } from 'react';
import { View, StyleSheet, Pressable, FlatList, ActivityIndicator, TextInput, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { isOrphanedMessageThread, type MessageThread } from '@/api/messages';
import { confirmAction } from '@/utils/confirmAction';
import ThreadRow from '@/components/messages/ThreadRow';
import { formatThreadTimestamp } from '@/components/messages/messageTime';
import { webTitleRef } from '@/utils/webProps';
import { useTranslation } from '@/i18n/LocaleProvider'


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
    onDeleteThread?: (threadId: number) => void;
    selectedThreadId?: number | null;
    showSearch?: boolean;
    /**
     * Пустой список без своей кнопки «Новый диалог»: на desktop её несёт пустая
     * правая панель экрана, вторая такая же рядом — лишняя (#2267).
     */
    hideEmptyStateAction?: boolean;
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
    onDeleteThread,
    selectedThreadId,
    showSearch,
    hideEmptyStateAction,
}: ThreadListProps) {
    const { t: i18nT } = useTranslation();
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const parsedUserId = currentUserId ? Number(currentUserId) : NaN;
    const currentUserIdNum = Number.isSafeInteger(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;
    const [search, setSearch] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    // #2127: удаление диалога спрашивает подтверждение. Web — встроенная строка
    // подтверждения под диалогом (своя вёрстка в списке); native — общий
    // confirmAction (системный Alert). Кнопка строки, долгое нажатие и действие
    // скринридера (`ThreadRow`, #2264) — один путь.
    const handleDeletePress = useCallback(
        (threadId: number) => {
            if (!onDeleteThread) return;

            if (Platform.OS === 'web') {
                setConfirmDeleteId((prev) => (prev === threadId ? null : threadId));
                return;
            }

            void confirmAction({
                title: i18nT('messages:components.messages.ThreadList.udalit_dialog_690a8668'),
                message: i18nT('messages:components.messages.ThreadList.vy_uvereny_chto_hotite_udalit_etot_dialog_cdd9a62d'),
                confirmText: i18nT('messages:components.messages.ThreadList.udalit_004e3e97'),
                cancelText: i18nT('messages:components.messages.ThreadList.otmena_c248c023'),
            }).then((confirmed) => {
                if (confirmed) onDeleteThread(threadId);
            });
        },
        [onDeleteThread, i18nT],
    );

    const handleConfirmDelete = useCallback(
        (threadId: number) => {
            setConfirmDeleteId(null);
            onDeleteThread?.(threadId);
        },
        [onDeleteThread],
    );
    const handleCancelDelete = useCallback(() => setConfirmDeleteId(null), []);

    const getOtherParticipantId = useCallback(
        (thread: MessageThread): number | null => {
            if (currentUserIdNum == null) return null;
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
            if (isOrphanedMessageThread(thread, currentUserIdNum)) {
                return i18nT('errorsStatic:api.messages.deletedUser');
            }
            return i18nT('messages:components.messages.ThreadList.polzovatel_3206a1df');
        },
        [currentUserIdNum, getOtherParticipantId, participantNames, i18nT]
    );

    const getPreview = useCallback((thread: MessageThread): string => {
        const preview = thread.last_message_preview;
        if (preview === undefined) return '';
        if (preview === null) return i18nT('messages:components.messages.ThreadList.net_soobscheniy_714b7881');
        // Deleted/moderated payloads may still contain text; never expose it.
        if (preview.is_deleted) return i18nT('messages:components.messages.ThreadList.previewDeleted');
        return currentUserIdNum != null && preview.sender_id === currentUserIdNum
            ? i18nT('messages:components.messages.ThreadList.previewOwn', { text: preview.text })
            : preview.text;
    }, [currentUserIdNum, i18nT]);

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

    const filteredThreads = useMemo(() => {
        if (!search.trim()) return threads;
        const q = search.trim().toLowerCase();
        return threads.filter((t) => {
            const name = getOtherParticipantName(t).toLowerCase();
            return name.includes(q);
        });
    }, [threads, search, getOtherParticipantName]);

    const renderItem = useCallback(
        ({ item }: { item: MessageThread }) => (
            <ThreadRow
                thread={item}
                name={getOtherParticipantName(item)}
                avatarUrl={getOtherParticipantAvatar(item)}
                time={formatThreadTimestamp(item.last_message_created_at)}
                preview={getPreview(item)}
                unreadCount={item.unread_count ?? 0}
                selected={selectedThreadId != null && item.id === selectedThreadId}
                onSelectThread={onSelectThread}
                onRequestDelete={onDeleteThread ? handleDeletePress : undefined}
                confirmingDelete={confirmDeleteId === item.id}
                onConfirmDelete={handleConfirmDelete}
                onCancelDelete={handleCancelDelete}
            />
        ),
        [getOtherParticipantName, getOtherParticipantAvatar, getPreview, onSelectThread, selectedThreadId, confirmDeleteId, handleConfirmDelete, handleCancelDelete, onDeleteThread, handleDeletePress]
    );

    // Шапка панели (#2267): поиск и главное действие панели — «Новый диалог».
    // Раньше действие было карточкой той же формы, что строка диалога, первой в
    // списке, и отличалось от собеседника только текстом.
    const newConversationLabel = i18nT('messages:components.messages.ThreadList.novyy_dialog_d3c8399a');
    const panelHeader = showSearch || onNewConversation ? (
        <View style={styles.panelHeader} testID="thread-list-header">
            {showSearch ? (
                <View style={[styles.searchContainer, { borderColor: colors.borderLight, backgroundColor: colors.backgroundSecondary }]}>
                    <Feather name="search" size={16} color={colors.textMuted} />
                    <TextInput
            {...searchInputAccessibilityProps()}
                        style={[styles.searchInput, { color: colors.text }]}
                        value={search}
                        onChangeText={setSearch}
                        placeholder={i18nT('messages:components.messages.ThreadList.poisk_b2d1212d')}
                        placeholderTextColor={colors.textMuted}
                        accessibilityLabel={i18nT('messages:components.messages.ThreadList.poisk_dialogov_8088fbb1')}
                    />
                    {search.length > 0 && (
                        <Pressable
                            onPress={() => setSearch('')}
                            style={styles.searchClear}
                            accessibilityRole="button"
                            accessibilityLabel={i18nT('messages:components.messages.ThreadList.ochistit_poisk_4c8b47a5')}
                        >
                            <Feather name="x" size={16} color={colors.textMuted} />
                        </Pressable>
                    )}
                </View>
            ) : (
                <View style={styles.panelHeaderSpacer} />
            )}
            {onNewConversation ? (
                <View ref={webTitleRef(newConversationLabel)}>
                    <Button
                        label={newConversationLabel}
                        onPress={onNewConversation}
                        variant="primary"
                        iconOnly
                        icon={<Feather name="edit" size={18} color={colors.textOnPrimary} />}
                        testID="thread-list-new-conversation"
                    />
                </View>
            ) : null}
        </View>
    ) : null;

    // Шапка панели — рамка, а не содержимое: она стоит над загрузкой, ошибкой,
    // пустым состоянием и списком одним и тем же узлом. Раньше её рисовала каждая
    // ветка сама (в списке — как `ListHeaderComponent`), а ветка загрузки не
    // рисовала вовсе: при открытии экрана поиск и «Новый диалог» снимались и
    // монтировались заново.
    let content: ReactElement;
    if (loading && threads.length === 0) {
        content = (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primaryDark} />
            </View>
        );
    } else if (error) {
        content = (
            <View style={styles.emptyWrap}>
                <EmptyState
                    density="compact"
                    variant="error"
                    icon="alert-circle"
                    title={error}
                    action={{
                        label: i18nT('messages:components.messages.ThreadList.povtorit_d1eae179'),
                        onPress: onRefresh,
                    }}
                    testID="thread-list-error"
                />
            </View>
        );
    } else if (threads.length === 0) {
        content = (
            <View style={styles.emptyWrap}>
                <EmptyState
                    density="compact"
                    variant="empty"
                    icon="message-circle"
                    title={i18nT('messages:components.messages.ThreadList.net_soobscheniy_714b7881')}
                    description={i18nT('messages:components.messages.ThreadList.napishite_avtoru_puteshestviya_chtoby_nachat_81bd050e')}
                    action={onNewConversation && !hideEmptyStateAction ? {
                        label: newConversationLabel,
                        onPress: onNewConversation,
                        icon: 'edit',
                    } : undefined}
                    testID="thread-list-empty"
                />
            </View>
        );
    } else {
        content = (
            <FlatList
                data={filteredThreads}
                extraData={[search, confirmDeleteId]}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
                style={styles.listScroll}
                contentContainerStyle={styles.list}
                refreshing={loading}
                onRefresh={onRefresh}
                ListEmptyComponent={
                    search.trim() ? (
                        <EmptyState
                            density="compact"
                            variant="search"
                            icon="search"
                            title={i18nT('messages:components.messages.ThreadList.nichego_ne_naydeno_86511b0f')}
                            description={i18nT('messages:components.messages.ThreadList.poprobuyte_izmenit_zapros_dc40a3c8')}
                            testID="thread-list-search-empty"
                        />
                    ) : null
                }
            />
        );
    }

    return (
        <View style={styles.panel}>
            {panelHeader}
            {content}
        </View>
    );
}

const SEARCH_FIELD_HEIGHT = 44;

const createStyles = (_colors: ThemedColors) =>
    StyleSheet.create({
        // Верхний отступ даёт шапка панели: она стоит над списком и не прокручивается.
        list: {
            paddingBottom: DESIGN_TOKENS.spacing.sm,
        },
        center: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: DESIGN_TOKENS.spacing.xl,
            paddingVertical: DESIGN_TOKENS.spacing.xxl,
        },
        emptyWrap: {
            flex: 1,
            justifyContent: 'center',
        },
        panel: {
            flex: 1,
            minHeight: 0,
        },
        listScroll: {
            flex: 1,
        },
        panelHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: DESIGN_TOKENS.spacing.xs,
            marginHorizontal: DESIGN_TOKENS.spacing.sm,
            marginTop: DESIGN_TOKENS.spacing.sm,
            marginBottom: DESIGN_TOKENS.spacing.xs,
        },
        panelHeaderSpacer: {
            flex: 1,
        },
        searchContainer: {
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: SEARCH_FIELD_HEIGHT,
            paddingLeft: DESIGN_TOKENS.spacing.md,
            borderWidth: 1,
            borderRadius: DESIGN_TOKENS.radii.lg,
            gap: DESIGN_TOKENS.spacing.xs,
        },
        searchInput: {
            flex: 1,
            minWidth: 0,
            fontSize: DESIGN_TOKENS.typography.sizes.sm,
            paddingVertical: DESIGN_TOKENS.spacing.xs,
            paddingRight: DESIGN_TOKENS.spacing.md,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
        },
        // Крестик 16px в рамке 44×44: вся рамка — тач-цель.
        searchClear: {
            width: SEARCH_FIELD_HEIGHT,
            height: SEARCH_FIELD_HEIGHT,
            marginLeft: -DESIGN_TOKENS.spacing.md,
            alignItems: 'center',
            justifyContent: 'center',
        },
    });

export default memo(ThreadList);
