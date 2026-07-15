import { useMemo } from 'react';
import { View, Text, Pressable, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import EmptyState from '@/components/ui/EmptyState';
import { useSecurityJournal } from '@/hooks/useSecurityJournal';
import type { SecurityJournalEventType } from '@/api/privacy';
import { formatDate as formatLocalizedDate, translate as i18nT } from '@/i18n'


const createEventMeta = (): Record<SecurityJournalEventType, { label: string; icon: keyof typeof Feather.glyphMap }> => ({
    login: { label: i18nT('profile:components.settings.SecurityJournalList.events.login'), icon: 'log-in' },
    logout: { label: i18nT('profile:components.settings.SecurityJournalList.events.logout'), icon: 'log-out' },
    password_change: { label: i18nT('profile:components.settings.SecurityJournalList.events.passwordChange'), icon: 'key' },
    social_link: { label: i18nT('profile:components.settings.SecurityJournalList.events.socialLink'), icon: 'link' },
    badge_grant: { label: i18nT('profile:components.settings.SecurityJournalList.events.badgeGrant'), icon: 'award' },
    contact_reveal: { label: i18nT('profile:components.settings.SecurityJournalList.events.contactReveal'), icon: 'eye' },
    moderator_action: { label: i18nT('profile:components.settings.SecurityJournalList.events.moderatorAction'), icon: 'shield' },
    other: { label: i18nT('profile:components.settings.SecurityJournalList.events.other'), icon: 'activity' },
});

const formatDate = (raw: string): string => {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    try {
        return formatLocalizedDate(date, {
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
    const eventMeta = createEventMeta();

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
                title={i18nT('profile:components.settings.SecurityJournalList.zhurnal_pust_e5b72bba')}
                description={i18nT('profile:components.settings.SecurityJournalList.zdes_budut_otobrazhatsya_sobytiya_bezopasnos_a961da13')}
            />
        );
    }

    return (
        <View style={styles.wrap}>
            {entries.map((entry) => {
                const meta = eventMeta[entry.event_type] ?? eventMeta.other;
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
                    accessibilityLabel={i18nT('profile:components.settings.SecurityJournalList.pokazat_esche_fc5aefec')}
                    {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                    {isFetchingNextPage ? (
                        <ActivityIndicator size="small" color={colors.primaryDark} />
                    ) : (
                        <Text style={styles.loadMoreText}>{i18nT('profile:components.settings.SecurityJournalList.pokazat_esche_fc5aefec')}</Text>
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
