import React, { memo, useCallback, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    FlatList,
    TextInput,
    Image,
    Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import type { MessagingUser } from '@/api/messages';
import { getMessagingUserDisplayName, getMessagingUserId } from '@/api/messages';

interface NewConversationPickerProps {
    users: MessagingUser[];
    loading: boolean;
    onSelectUser: (userId: number) => void;
    onClose: () => void;
}

function NewConversationPicker({
    users,
    loading,
    onSelectUser,
    onClose,
}: NewConversationPickerProps) {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [search, setSearch] = useState('');

    const filteredUsers = useMemo(() => {
        if (!search.trim()) return users;
        const q = search.trim().toLowerCase();
        return users.filter((u) => {
            const name = getMessagingUserDisplayName(u).toLowerCase();
            return name.includes(q);
        });
    }, [users, search]);

    const renderItem = useCallback(
        ({ item }: { item: MessagingUser }) => {
            const name = getMessagingUserDisplayName(item);
            const uid = getMessagingUserId(item);
            return (
                <Pressable
                    style={({ pressed }) => [
                        styles.userItem,
                        { backgroundColor: colors.surface, borderColor: colors.borderLight },
                        pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => onSelectUser(uid)}
                    accessibilityRole="button"
                    accessibilityLabel={`Написать ${name}`}
                >
                    <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                        {item.avatar ? (
                            <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
                        ) : (
                            <Feather name="user" size={20} color={colors.primary} />
                        )}
                    </View>
                    <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                        {name}
                    </Text>
                    <Feather name="message-circle" size={18} color={colors.textMuted} />
                </Pressable>
            );
        },
        [colors, styles, onSelectUser]
    );

    return (
        <View style={styles.container}>
            <View style={[styles.header, { borderColor: colors.borderLight }]}>
                <Pressable
                    onPress={onClose}
                    style={styles.backButton}
                    accessibilityRole="button"
                    accessibilityLabel="Назад к списку диалогов"
                >
                    <Feather name="arrow-left" size={22} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Новый диалог</Text>
            </View>

            <View style={[styles.searchContainer, { borderColor: colors.borderLight }]}>
                <Feather name="search" size={16} color={colors.textMuted} />
                <TextInput
                    style={[
                        styles.searchInput,
                        { color: colors.text, backgroundColor: 'transparent' },
                    ]}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Поиск по имени..."
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel="Поиск пользователя"
                />
                {search.length > 0 && (
                    <Pressable onPress={() => setSearch('')} accessibilityLabel="Очистить поиск">
                        <Feather name="x" size={16} color={colors.textMuted} />
                    </Pressable>
                )}
            </View>

            {filteredUsers.length === 0 && !loading ? (
                <View style={styles.emptyContainer}>
                    <Feather name="users" size={40} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        {search.trim() ? 'Пользователи не найдены' : 'Нет доступных пользователей'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredUsers}
                    keyExtractor={(item) => String(getMessagingUserId(item))}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                />
            )}
        </View>
    );
}

const createStyles = (colors: ThemedColors) =>
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
        headerTitle: {
            flex: 1,
            fontSize: DESIGN_TOKENS.typography.sizes.md,
            fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        },
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: DESIGN_TOKENS.spacing.md,
            marginVertical: DESIGN_TOKENS.spacing.sm,
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            paddingVertical: DESIGN_TOKENS.spacing.xs,
            borderWidth: 1,
            borderRadius: DESIGN_TOKENS.radii.lg,
            backgroundColor: colors.backgroundSecondary,
            gap: DESIGN_TOKENS.spacing.xs,
        },
        searchInput: {
            flex: 1,
            fontSize: DESIGN_TOKENS.typography.sizes.sm,
            paddingVertical: DESIGN_TOKENS.spacing.xs,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
        },
        list: {
            paddingVertical: DESIGN_TOKENS.spacing.xs,
        },
        userItem: {
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
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: DESIGN_TOKENS.spacing.sm,
            overflow: 'hidden',
        },
        avatarImage: {
            width: 40,
            height: 40,
            borderRadius: 20,
        },
        userName: {
            flex: 1,
            fontSize: DESIGN_TOKENS.typography.sizes.md,
            fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
            marginRight: DESIGN_TOKENS.spacing.xs,
        },
        emptyContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: DESIGN_TOKENS.spacing.xxl,
            gap: DESIGN_TOKENS.spacing.md,
        },
        emptyText: {
            fontSize: DESIGN_TOKENS.typography.sizes.sm,
            textAlign: 'center',
        },
    });

export default memo(NewConversationPicker);
