import { useMemo } from 'react';
import { View, Text, Pressable, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { usePrivacySettings } from '@/hooks/usePrivacySettings';
import {
    PRIVACY_CONTENT_TYPES,
    PRIVACY_AUDIENCES,
    type PrivacyContentType,
    type PrivacyAudience,
} from '@/api/privacy';
import { translate as i18nT } from '@/i18n'


const createContentLabels = (): Record<PrivacyContentType, { title: string; meta: string; icon: keyof typeof Feather.glyphMap }> => ({
    trips: { title: i18nT('profile:components.settings.PrivacySettingsMatrix.content.trips.title'), meta: i18nT('profile:components.settings.PrivacySettingsMatrix.content.trips.meta'), icon: 'map' },
    routes: { title: i18nT('profile:components.settings.PrivacySettingsMatrix.content.routes.title'), meta: i18nT('profile:components.settings.PrivacySettingsMatrix.content.routes.meta'), icon: 'navigation' },
    social: { title: i18nT('profile:components.settings.PrivacySettingsMatrix.content.social.title'), meta: i18nT('profile:components.settings.PrivacySettingsMatrix.content.social.meta'), icon: 'at-sign' },
    achievements: { title: i18nT('profile:components.settings.PrivacySettingsMatrix.content.achievements.title'), meta: i18nT('profile:components.settings.PrivacySettingsMatrix.content.achievements.meta'), icon: 'award' },
    visited_places: { title: i18nT('profile:components.settings.PrivacySettingsMatrix.content.visitedPlaces.title'), meta: i18nT('profile:components.settings.PrivacySettingsMatrix.content.visitedPlaces.meta'), icon: 'check-circle' },
});

const createAudienceLabels = (): Record<PrivacyAudience, string> => ({
    all: i18nT('profile:components.settings.PrivacySettingsMatrix.audience.all'),
    registered: i18nT('profile:components.settings.PrivacySettingsMatrix.audience.registered'),
    followers: i18nT('profile:components.settings.PrivacySettingsMatrix.audience.followers'),
    only_me: i18nT('profile:components.settings.PrivacySettingsMatrix.audience.onlyMe'),
});

type Props = {
    /** Заголовок секции (опц.) — скрывается, когда матрица встроена в экран со своим заголовком. */
    showHeading?: boolean;
};

export default function PrivacySettingsMatrix({ showHeading = false }: Props) {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { settings, isLoading, isSaving, setAudience } = usePrivacySettings();
    const contentLabels = createContentLabels();
    const audienceLabels = createAudienceLabels();

    if (isLoading) {
        return (
            <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={colors.primaryDark} />
            </View>
        );
    }

    return (
        <View style={styles.wrap}>
            {showHeading ? <Text style={styles.heading}>{i18nT('profile:components.settings.PrivacySettingsMatrix.nastroyki_privatnosti_e8b8f4f1')}</Text> : null}
            <Text style={styles.intro}>
                {i18nT('profile:components.settings.PrivacySettingsMatrix.vyberite_kto_mozhet_videt_raznye_tipy_vasheg_d9566b1a')}</Text>

            {PRIVACY_CONTENT_TYPES.map((contentType) => {
                const meta = contentLabels[contentType];
                const selected = settings[contentType];
                return (
                    <View key={contentType} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardIcon}>
                                <Feather name={meta.icon} size={16} color={colors.primaryDark} />
                            </View>
                            <View style={styles.cardTextBlock}>
                                <Text style={styles.cardTitle}>{meta.title}</Text>
                                <Text style={styles.cardMeta}>{meta.meta}</Text>
                            </View>
                        </View>

                        <View
                            style={styles.segmentRow}
                            accessibilityRole="radiogroup"
                            accessibilityLabel={i18nT('profile:components.settings.PrivacySettingsMatrix.auditoriya_value1_14cb181a', { value1: meta.title })}
                        >
                            {PRIVACY_AUDIENCES.map((audience) => {
                                const isActive = selected === audience;
                                return (
                                    <Pressable
                                        key={audience}
                                        onPress={() => setAudience(contentType, audience)}
                                        disabled={isSaving}
                                        style={[
                                            styles.segment,
                                            isActive && styles.segmentActive,
                                            globalFocusStyles.focusable,
                                        ]}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: isActive, disabled: isSaving }}
                                        accessibilityLabel={audienceLabels[audience]}
                                        {...Platform.select({ web: { cursor: 'pointer' } })}
                                    >
                                        <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                                            {audienceLabels[audience]}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
    StyleSheet.create({
        wrap: { gap: 12 },
        heading: { fontSize: 18, fontWeight: '700', color: colors.text },
        intro: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
        loadingBox: { paddingVertical: 32, alignItems: 'center' },
        card: {
            backgroundColor: colors.surface,
            borderRadius: DESIGN_TOKENS.radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            gap: 12,
        },
        cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        cardIcon: {
            width: 36,
            height: 36,
            borderRadius: DESIGN_TOKENS.radii.pill,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
        },
        cardTextBlock: { flex: 1 },
        cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
        cardMeta: { marginTop: 2, fontSize: 12, color: colors.textMuted },
        segmentRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        segment: {
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: DESIGN_TOKENS.radii.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        segmentActive: {
            borderColor: colors.primary,
            backgroundColor: colors.primarySoft,
        },
        segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
        segmentTextActive: { color: colors.primaryText },
    });
