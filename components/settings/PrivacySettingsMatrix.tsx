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

const CONTENT_LABELS: Record<PrivacyContentType, { title: string; meta: string; icon: keyof typeof Feather.glyphMap }> = {
    trips: { title: 'Путешествия', meta: 'Кто видит ваши опубликованные путешествия', icon: 'map' },
    routes: { title: 'Маршруты', meta: 'Кто видит ваши сохранённые маршруты', icon: 'navigation' },
    social: { title: 'Контакты и соцсети', meta: 'Кто видит ваши ссылки на соцсети', icon: 'at-sign' },
    achievements: { title: 'Достижения', meta: 'Кто видит ваши значки и уровень', icon: 'award' },
    visited_places: { title: 'Посещённые места', meta: 'Кто видит карту ваших посещений', icon: 'check-circle' },
};

const AUDIENCE_LABELS: Record<PrivacyAudience, string> = {
    all: 'Все',
    registered: 'Зарегистр.',
    followers: 'Подписчики',
    only_me: 'Только я',
};

type Props = {
    /** Заголовок секции (опц.) — скрывается, когда матрица встроена в экран со своим заголовком. */
    showHeading?: boolean;
};

export default function PrivacySettingsMatrix({ showHeading = false }: Props) {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { settings, isLoading, isSaving, setAudience } = usePrivacySettings();

    if (isLoading) {
        return (
            <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={colors.primaryDark} />
            </View>
        );
    }

    return (
        <View style={styles.wrap}>
            {showHeading ? <Text style={styles.heading}>Настройки приватности</Text> : null}
            <Text style={styles.intro}>
                Выберите, кто может видеть разные типы вашего контента. Изменения сохраняются автоматически.
            </Text>

            {PRIVACY_CONTENT_TYPES.map((contentType) => {
                const meta = CONTENT_LABELS[contentType];
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
                            accessibilityLabel={`Аудитория: ${meta.title}`}
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
                                        accessibilityLabel={AUDIENCE_LABELS[audience]}
                                        {...Platform.select({ web: { cursor: 'pointer' } })}
                                    >
                                        <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                                            {AUDIENCE_LABELS[audience]}
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
