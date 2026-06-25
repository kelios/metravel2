import { useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { openExternalUrl } from '@/utils/externalLinks';
import { confirmAction } from '@/utils/confirmAction';
import { showToast } from '@/utils/toast';
import { requestContactAccess, type ContactAccessStatus } from '@/api/privacy';
import { ApiError } from '@/api/client';

export type SocialLink = {
    key: string;
    label: string;
    value: string;
};

type Props = {
    socials: SocialLink[];
    isOwnProfile: boolean;
    /** Бэк помечает профиль, чьи контакты защищены (BE-contact-protection). */
    contactsHidden?: boolean;
    /** Уровень доступа текущего зрителя к контактам. */
    contactAccess?: ContactAccessStatus;
    targetUserId: string | number | null;
};

/**
 * FE-contact-protection-ui (Sprint 18): гейт на контакты/соцсети в публичном профиле.
 * Пока бэк не выставит contacts_hidden=true — ведёт себя как раньше (показывает чипы).
 * Когда защита активна — скрывает контакты до одобрения и требует согласие перед раскрытием.
 */
export default function ProtectedContacts({
    socials,
    isOwnProfile,
    contactsHidden,
    contactAccess = 'none',
    targetUserId,
}: Props) {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [access, setAccess] = useState<ContactAccessStatus>(contactAccess);
    const [requesting, setRequesting] = useState(false);

    const gateActive = !isOwnProfile && contactsHidden === true && access !== 'granted';

    const handleRequest = useCallback(async () => {
        if (!targetUserId || requesting) return;
        // FE-consent-contact-exchange: предупреждение перед раскрытием.
        const confirmed = await confirmAction({
            title: 'Запросить контакты',
            message:
                'Запрос на раскрытие контактов будет отправлен пользователю. После одобрения он также увидит ваши контакты. Продолжить?',
            confirmText: 'Запросить',
        });
        if (!confirmed) return;

        setRequesting(true);
        try {
            const res = await requestContactAccess(targetUserId);
            setAccess(res.status);
            showToast({
                type: 'success',
                text1: res.status === 'granted' ? 'Контакты раскрыты' : 'Запрос отправлен',
            });
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Не удалось отправить запрос';
            showToast({ type: 'error', text1: 'Ошибка', text2: message });
        } finally {
            setRequesting(false);
        }
    }, [targetUserId, requesting]);

    const renderChips = () => (
        <View style={styles.socialsRow}>
            {socials.map((s) => (
                <Pressable
                    key={s.key}
                    style={[styles.socialChip, globalFocusStyles.focusable]}
                    onPress={() => openExternalUrl(String(s.value))}
                    accessibilityRole="link"
                    accessibilityLabel={`Открыть ${s.label}`}
                    {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                    <Text style={styles.socialChipText}>{s.label}</Text>
                </Pressable>
            ))}
        </View>
    );

    // Защита неактивна — обычное поведение (контакты видны, если они есть).
    if (!gateActive) {
        if (socials.length === 0) return null;
        return renderChips();
    }

    // Контакты есть, но скрыты до одобрения.
    return (
        <View style={styles.gateCard}>
            <View style={styles.gateHeader}>
                <Feather name="lock" size={16} color={colors.textMuted} />
                <Text style={styles.gateTitle}>Контакты скрыты</Text>
            </View>
            <Text style={styles.gateMeta}>
                {access === 'pending'
                    ? 'Запрос на раскрытие контактов отправлен и ожидает одобрения.'
                    : 'Контакты этого пользователя видны после одобрения заявки.'}
            </Text>

            {access === 'none' ? (
                <Pressable
                    style={[styles.requestButton, globalFocusStyles.focusable]}
                    onPress={handleRequest}
                    disabled={requesting}
                    accessibilityRole="button"
                    accessibilityLabel="Запросить контакты"
                    {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                    {requesting ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <>
                            <Feather name="user-plus" size={16} color={colors.primary} />
                            <Text style={styles.requestButtonText}>Запросить контакты</Text>
                        </>
                    )}
                </Pressable>
            ) : (
                <View style={styles.pendingBadge}>
                    <Feather name="clock" size={14} color={colors.warning} />
                    <Text style={styles.pendingText}>Заявка отправлена</Text>
                </View>
            )}
        </View>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
    StyleSheet.create({
        socialsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        socialChip: {
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: DESIGN_TOKENS.radii.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        socialChipText: { fontSize: 13, fontWeight: '600', color: colors.primary },
        gateCard: {
            gap: 8,
            padding: 12,
            borderRadius: DESIGN_TOKENS.radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
        },
        gateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        gateTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
        gateMeta: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
        requestButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: DESIGN_TOKENS.radii.sm,
            borderWidth: 1,
            borderColor: colors.primary,
            backgroundColor: colors.surface,
            minHeight: 40,
            alignSelf: 'flex-start',
        },
        requestButtonText: { fontSize: 14, fontWeight: '600', color: colors.primary },
        pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
        pendingText: { fontSize: 13, fontWeight: '600', color: colors.warning },
    });
