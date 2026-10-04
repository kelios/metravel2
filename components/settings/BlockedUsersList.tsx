// #2134: список заблокированных (Настройки → Приватность и данные → Заблокированные).
// Источник — `useBlockedUsers` (`myBlockedUsers(owner)`), тот же кэш, по которому
// guard скрывает контент. «Разблокировать» спрашивает подтверждение; мутация
// сразу убирает строку из списка и возвращает контент автора в ленты.

import { useMemo, useState } from 'react';
import { View, Text, Image, Pressable, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';

import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import { useBlockedUsers, useUnblockUser } from '@/hooks/useUserSafety';
import { toAuthorId } from '@/api/blockSensitiveQueries';
import type { UserProfileDto } from '@/api/user';
import { resolveProfileFullName } from '@/utils/profileName';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { confirmUnblockUser } from '@/utils/confirmUserBlock';
import { routes } from '@/utils/routes';
import { translate as i18nT } from '@/i18n';

const AVATAR_SIZE = 40;

const initialsOf = (name: string): string =>
    name
        .split(' ')
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

export default function BlockedUsersList() {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const blockedQuery = useBlockedUsers();
    const unblockMutation = useUnblockUser();
    const [pendingUserId, setPendingUserId] = useState<number | null>(null);

    const handleUnblock = async (userId: number, name: string) => {
        if (!(await confirmUnblockUser(name))) return;
        setPendingUserId(userId);
        unblockMutation.mutate(userId, { onSettled: () => setPendingUserId(null) });
    };

    if (blockedQuery.isLoading) {
        return (
            <View style={styles.loadingBox} testID="blocked-users-loading">
                <ActivityIndicator size="small" color={colors.primaryDark} />
            </View>
        );
    }

    if (blockedQuery.isError) {
        return (
            <EmptyState
                density="compact"
                variant="error"
                icon="alert-circle"
                title={i18nT('profile:app.blocked_users.loadErrorTitle')}
                action={{
                    label: i18nT('profile:app.blocked_users.retry'),
                    onPress: () => void blockedQuery.refetch(),
                }}
                testID="blocked-users-error"
            />
        );
    }

    const users = (blockedQuery.data ?? []).filter((profile: UserProfileDto) => toAuthorId(profile.user) !== null);

    if (users.length === 0) {
        return (
            <EmptyState
                density="compact"
                variant="empty"
                icon="user-check"
                title={i18nT('profile:app.blocked_users.emptyTitle')}
                description={i18nT('profile:app.blocked_users.emptyDescription')}
                testID="blocked-users-empty"
            />
        );
    }

    return (
        <View style={styles.wrap} testID="blocked-users-list">
            {users.map((profile) => {
                const userId = toAuthorId(profile.user) as number;
                const name = resolveProfileFullName(profile) || i18nT('profile:app.blocked_users.userFallback');
                const avatarUri = profile.avatar
                    ? optimizeImageUrl(profile.avatar, { width: 96, quality: 70, fit: 'cover' }) ?? profile.avatar
                    : null;
                return (
                    <View key={String(userId)} style={styles.row} testID={`blocked-user-${userId}`}>
                        <Pressable
                            style={[styles.identity, globalFocusStyles.focusable]}
                            onPress={() => router.push(routes.user(userId))}
                            accessibilityRole="link"
                            accessibilityLabel={i18nT('profile:app.blocked_users.openProfile', { name })}
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <View style={styles.avatar}>
                                {avatarUri ? (
                                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                                ) : (
                                    <Text style={styles.avatarInitials}>{initialsOf(name)}</Text>
                                )}
                            </View>
                            <Text style={styles.name} numberOfLines={2}>{name}</Text>
                        </Pressable>
                        <Button
                            label={i18nT('profile:app.blocked_users.unblock')}
                            accessibilityLabel={i18nT('profile:app.blocked_users.unblockNamed', { name })}
                            onPress={() => void handleUnblock(userId, name)}
                            loading={pendingUserId === userId}
                            disabled={pendingUserId !== null}
                            variant="secondary"
                            size="sm"
                            icon={<Feather name="user-check" size={16} color={colors.primaryDark} />}
                            testID={`blocked-user-unblock-${userId}`}
                        />
                    </View>
                );
            })}
        </View>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
    StyleSheet.create({
        wrap: { gap: 8 },
        loadingBox: { paddingVertical: 32, alignItems: 'center' },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: colors.surface,
            borderRadius: DESIGN_TOKENS.radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
        },
        identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
        avatar: {
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: DESIGN_TOKENS.radii.pill,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
        },
        avatarImage: { width: AVATAR_SIZE, height: AVATAR_SIZE },
        avatarInitials: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
        // flexShrink обязателен: на Android текст в row без него обрезается без переноса.
        name: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.text },
    });
