import { useMemo } from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import Button from '@/components/ui/Button';
import { useDataOwnership } from '@/hooks/useDataOwnership';

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
                    <Feather name="download-cloud" size={18} color={colors.primary} />
                </View>
                <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>Мои данные</Text>
                    <Text style={styles.cardMeta}>Экспорт и удаление ваших данных</Text>
                </View>
            </View>

            <Button
                label={isExporting ? 'Запрашиваем…' : 'Экспортировать мои данные'}
                onPress={exportData}
                loading={isExporting}
                disabled={isExporting}
                variant="secondary"
                fullWidth
                size="md"
                icon={<Feather name="download" size={16} color={colors.primary} />}
            />

            <View style={styles.divider} />

            <Pressable
                style={[styles.dangerButton, globalFocusStyles.focusable]}
                onPress={deleteMessages}
                disabled={isDeletingMessages}
                accessibilityRole="button"
                accessibilityLabel="Удалить переписку"
                {...Platform.select({ web: { cursor: 'pointer' } })}
            >
                <Feather name="message-square" size={18} color={colors.danger} />
                <Text style={styles.dangerButtonText}>
                    {isDeletingMessages ? 'Удаляем…' : 'Удалить переписку'}
                </Text>
            </Pressable>

            <Pressable
                style={[styles.dangerButton, globalFocusStyles.focusable]}
                onPress={deleteRoutes}
                disabled={isDeletingRoutes}
                accessibilityRole="button"
                accessibilityLabel="Удалить маршруты"
                {...Platform.select({ web: { cursor: 'pointer' } })}
            >
                <Feather name="navigation" size={18} color={colors.danger} />
                <Text style={styles.dangerButtonText}>
                    {isDeletingRoutes ? 'Удаляем…' : 'Удалить маршруты'}
                </Text>
            </Pressable>

            <Pressable
                style={[styles.subtleButton, globalFocusStyles.focusable]}
                onPress={revokeConsents}
                disabled={isRevokingConsents}
                accessibilityRole="button"
                accessibilityLabel="Отозвать согласия"
                {...Platform.select({ web: { cursor: 'pointer' } })}
            >
                <Feather name="shield-off" size={18} color={colors.textMuted} />
                <Text style={styles.subtleButtonText}>
                    {isRevokingConsents ? 'Отзываем…' : 'Отозвать согласия'}
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
        dangerButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            paddingVertical: 12,
            borderRadius: DESIGN_TOKENS.radii.sm,
            borderWidth: 1,
            borderColor: colors.danger,
            backgroundColor: colors.surface,
        },
        dangerButtonText: { fontSize: 14, fontWeight: '700', color: colors.danger },
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
