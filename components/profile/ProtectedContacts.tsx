import { useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import Button from '@/components/ui/Button';
import { openExternalUrl } from '@/utils/externalLinks';
import { confirmAction } from '@/utils/confirmAction';
import { showToast } from '@/utils/toast';
import { requestContactAccess, type ContactAccessStatus } from '@/api/privacy';
import { ApiError } from '@/api/client';
import { translate as i18nT } from '@/i18n'


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
            title: i18nT('profile:components.profile.ProtectedContacts.zaprosit_kontakty_17ae693d'),
            message:
                i18nT('profile:components.profile.ProtectedContacts.zapros_na_raskrytie_kontaktov_budet_otpravle_b34f78c5'),
            confirmText: i18nT('profile:components.profile.ProtectedContacts.zaprosit_49cb2f29'),
        });
        if (!confirmed) return;

        setRequesting(true);
        try {
            const res = await requestContactAccess(targetUserId);
            setAccess(res.status);
            showToast({
                type: 'success',
                text1: res.status === 'granted' ? i18nT('profile:components.profile.ProtectedContacts.kontakty_raskryty_d7169a49') : i18nT('profile:components.profile.ProtectedContacts.zapros_otpravlen_34d2fb79'),
            });
        } catch (error) {
            const message = error instanceof ApiError ? error.message : i18nT('profile:components.profile.ProtectedContacts.ne_udalos_otpravit_zapros_c26699a2');
            showToast({ type: 'error', text1: i18nT('profile:components.profile.ProtectedContacts.oshibka_327bf4ba'), text2: message });
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
                    accessibilityLabel={i18nT('profile:components.profile.ProtectedContacts.otkryt_value1_a2bb4ba1', { value1: s.label })}
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
                <Text style={styles.gateTitle}>{i18nT('profile:components.profile.ProtectedContacts.kontakty_skryty_b9711aeb')}</Text>
            </View>
            <Text style={styles.gateMeta}>
                {access === 'pending'
                    ? i18nT('profile:components.profile.ProtectedContacts.zapros_na_raskrytie_kontaktov_otpravlen_i_oz_6d521f08')
                    : i18nT('profile:components.profile.ProtectedContacts.kontakty_etogo_polzovatelya_vidny_posle_odob_73a72cb1')}
            </Text>

            {access === 'none' ? (
                <Button
                    label={i18nT('profile:components.profile.ProtectedContacts.zaprosit_kontakty_17ae693d')}
                    onPress={handleRequest}
                    variant="outline"
                    size="sm"
                    loading={requesting}
                    icon={<Feather name="user-plus" size={16} color={colors.primaryDark} />}
                    accessibilityLabel={i18nT('profile:components.profile.ProtectedContacts.zaprosit_kontakty_17ae693d')}
                    style={styles.requestButton}
                />
            ) : (
                <View style={styles.pendingBadge}>
                    <Feather name="clock" size={14} color={colors.warning} />
                    <Text style={styles.pendingText}>{i18nT('profile:components.profile.ProtectedContacts.zayavka_otpravlena_8639e445')}</Text>
                </View>
            )}
        </View>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
    StyleSheet.create({
        socialsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: DESIGN_TOKENS.spacing.sm },
        socialChip: {
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: DESIGN_TOKENS.radii.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        socialChipText: { fontSize: 13, fontWeight: '600', color: colors.primaryText },
        gateCard: {
            gap: 8,
            padding: 12,
            marginTop: DESIGN_TOKENS.spacing.sm,
            borderRadius: DESIGN_TOKENS.radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
        },
        gateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        gateTitle: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.text },
        gateMeta: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
        requestButton: {
            alignSelf: 'flex-start',
        },
        pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
        pendingText: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: colors.warning },
    });
