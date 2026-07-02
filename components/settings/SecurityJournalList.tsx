import { useMemo } from 'react';
import { View, Text, Pressable, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import EmptyState from '@/components/ui/EmptyState';
import { useSecurityJournal } from '@/hooks/useSecurityJournal';
import type { SecurityJournalEventType } from '@/api/privacy';

const EVENT_META: Record<SecurityJournalEventType, { label: string; icon: keyof typeof Feather.glyphMap }> = {
    login: { label: 'Вход в аккаунт', icon: 'log-in' },
    logout: { label: 'Выход из аккаунта', icon: 'log-out' },
    password_change: { label: 'Смена пароля', icon: 'key' },
    social_link: { label: 'Привязка соцсети', icon: 'link' },
    badge_grant: { label: 'Выдача значка', icon: 'award' },
    contact_reveal: { label: 'Раскрытие контактов', icon: 'eye' },
    moderator_action: { label: 'Действие модератора', icon: 'shield' },
    other: { label: 'Событие безопасности', icon: 'activity' },
};

const formatDate = (raw: string): string => {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    try {
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return date.toISOString();
    }
};

export default function SecurityJournalList() {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { entries, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useSecurityJournal();

    if (isLoading) {
        return (
            <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={colors.primaryDark} />
            </View>
        );
    }

    if (entries.length === 0) {
        return (
            <EmptyState
                icon="shield"
                title="Журнал пуст"
                description="Здесь будут отображаться события безопасности вашего аккаунта: входы, смена пароля, привязки соцсетей."
            />
        );
    }

    return (
        <View style={styles.wrap}>
            {entries.map((entry) => {
                const meta = EVENT_META[entry.event_type] ?? EVENT_META.other;
                const details = [entry.device, entry.ip_address].filter(Boolean).join(' · ');
                return (
                    <View key={String(entry.id)} style={styles.row}>
                        <View style={styles.rowIcon}>
                            <Feather name={meta.icon} size={16} color={colors.primaryDark} />
                        </View>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>{meta.label}</Text>
                            <Text style={styles.rowMeta}>{formatDate(entry.created_at)}</Text>
                            {details ? <Text style={styles.rowMeta}>{details}</Text> : null}
                        </View>
                    </View>
                );
            })}

            {hasNextPage ? (
                <Pressable
                    style={[styles.loadMore, globalFocusStyles.focusable]}
                    onPress={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    accessibilityRole="button"
                    accessibilityLabel="Показать ещё"
                    {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                    {isFetchingNextPage ? (
                        <ActivityIndicator size="small" color={colors.primaryDark} />
                    ) : (
                        <Text style={styles.loadMoreText}>Показать ещё</Text>
                    )}
                </Pressable>
            ) : null}
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
        rowIcon: {
            width: 36,
            height: 36,
            borderRadius: DESIGN_TOKENS.radii.pill,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
        },
        rowText: { flex: 1 },
        rowTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
        rowMeta: { marginTop: 2, fontSize: 12, color: colors.textMuted },
        loadMore: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            borderRadius: DESIGN_TOKENS.radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            minHeight: 44,
        },
        loadMoreText: { fontSize: 14, fontWeight: '600', color: colors.primaryText },
    });
