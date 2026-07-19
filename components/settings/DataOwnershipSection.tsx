import { useMemo } from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import Button from '@/components/ui/Button';
import { useDataOwnership } from '@/hooks/useDataOwnership';
import { translate as i18nT } from '@/i18n'


/**
 * Управление своими данными: экспорт архива, удаление переписки/маршрутов,
 * отзыв согласий. Встраивается в settings.tsx в секцию «Приватность и данные».
 */
export default function DataOwnershipSection() {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const {
        exportData,
        deleteMessages,
        deleteRoutes,
        revokeConsents,
        isExporting,
        isDeletingMessages,
        isDeletingRoutes,
        isRevokingConsents,
    } = useDataOwnership();

    return (
        <View style={styles.card}>
            <View style={styles.cardRow}>
                <View style={styles.cardIcon}>
                    <Feather name="download-cloud" size={18} color={colors.primaryDark} />
                </View>
                <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{i18nT('profile:components.settings.DataOwnershipSection.moi_dannye_12de8ed5')}</Text>
                    <Text style={styles.cardMeta}>{i18nT('profile:components.settings.DataOwnershipSection.eksport_i_udalenie_vashih_dannyh_4ea20ef6')}</Text>
                </View>
            </View>

            <Button
                label={isExporting ? i18nT('profile:components.settings.DataOwnershipSection.zaprashivaem_c12db78a') : i18nT('profile:components.settings.DataOwnershipSection.eksportirovat_moi_dannye_5dbf40a3')}
                onPress={exportData}
                loading={isExporting}
                disabled={isExporting}
                variant="secondary"
                fullWidth
                size="md"
                icon={<Feather name="download" size={16} color={colors.primaryDark} />}
            />

            <View style={styles.divider} />

            <Button
                variant="danger-outline"
                fullWidth
                onPress={deleteMessages}
                loading={isDeletingMessages}
                disabled={isDeletingMessages}
                label={i18nT('profile:components.settings.DataOwnershipSection.udalit_perepisku_eb5f6cf8')}
                accessibilityLabel={i18nT('profile:components.settings.DataOwnershipSection.udalit_perepisku_eb5f6cf8')}
                icon={<Feather name="message-square" size={18} color={colors.danger} />}
            />

            <Button
                variant="danger-outline"
                fullWidth
                onPress={deleteRoutes}
                loading={isDeletingRoutes}
                disabled={isDeletingRoutes}
                label={i18nT('profile:components.settings.DataOwnershipSection.udalit_marshruty_f569fb47')}
                accessibilityLabel={i18nT('profile:components.settings.DataOwnershipSection.udalit_marshruty_f569fb47')}
                icon={<Feather name="navigation" size={18} color={colors.danger} />}
            />

            <Pressable
                style={[styles.subtleButton, globalFocusStyles.focusable]}
                onPress={revokeConsents}
                disabled={isRevokingConsents}
                accessibilityRole="button"
                accessibilityLabel={i18nT('profile:components.settings.DataOwnershipSection.otozvat_soglasiya_a71fe389')}
                {...Platform.select({ web: { cursor: 'pointer' } })}
            >
                <Feather name="shield-off" size={18} color={colors.textMuted} />
                <Text style={styles.subtleButtonText}>
                    {isRevokingConsents ? i18nT('profile:components.settings.DataOwnershipSection.otzyvaem_cc9508e0') : i18nT('profile:components.settings.DataOwnershipSection.otozvat_soglasiya_a71fe389')}
                </Text>
            </Pressable>
        </View>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
    StyleSheet.create({
        card: {
            backgroundColor: colors.surface,
            borderRadius: DESIGN_TOKENS.radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            gap: 12,
        },
        cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        cardIcon: {
            width: 36,
            height: 36,
            borderRadius: DESIGN_TOKENS.radii.pill,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
        },
        cardText: { flex: 1 },
        cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
        cardMeta: { marginTop: 2, fontSize: 12, color: colors.textMuted },
        divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
        subtleButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            paddingVertical: 12,
            borderRadius: DESIGN_TOKENS.radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        subtleButtonText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
    });
