import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';

type TravelWizardHeaderProps = {
    canGoBack?: boolean;
    onBack?: () => void;
    title: string;
    subtitle: string;
    progressPercent: number;
    autosaveBadge?: string;
    extraBelowProgress?: React.ReactNode;
    tipTitle?: string;
    tipBody?: string;
};

const TravelWizardHeader: React.FC<TravelWizardHeaderProps> = ({
    canGoBack = false,
    onBack,
    title,
    subtitle,
    progressPercent,
    autosaveBadge,
    extraBelowProgress,
    tipTitle,
    tipBody,
}) => {
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const clamped = Math.min(Math.max(progressPercent, 0), 100);
    
    // Определяем цвет прогресс-бара на основе процента
    const progressColor = useMemo(() => {
        if (clamped < 33) return DESIGN_TOKENS.colors.dangerLight;
        if (clamped < 67) return '#FFD93D'; // warning yellow
        return DESIGN_TOKENS.colors.successDark;
    }, [clamped]);

    const [isTipOpen, setIsTipOpen] = useState(false);
    const hasTip = !!tipBody && tipBody.trim().length > 0;
    const resolvedTipTitle = useMemo(() => tipTitle ?? 'Совет', [tipTitle]);

    const TipTrigger = hasTip ? (
        <Pressable
            onPress={() => setIsTipOpen(v => !v)}
            style={[styles.tipToggleButton, isTipOpen && styles.tipToggleButtonActive]}
            accessibilityRole="button"
            accessibilityLabel={isTipOpen ? 'Скрыть совет' : 'Показать совет'}
            {...Platform.select({ web: { cursor: 'pointer' } })}
        >
            <Feather
                name="help-circle"
                size={isMobile ? 14 : 16}
                color={isTipOpen ? DESIGN_TOKENS.colors.primary : DESIGN_TOKENS.colors.textSubtle}
            />
            {!isMobile && (
                <Text style={[styles.tipToggleText, isTipOpen && styles.tipToggleTextActive]} numberOfLines={1}>
                    {resolvedTipTitle}
                </Text>
            )}
        </Pressable>
    ) : null;

    const BackButton = canGoBack ? (
        <Pressable
            onPress={onBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            disabled={!onBack}
            {...Platform.select({ web: { cursor: 'pointer' } })}
        >
            <Feather name="arrow-left" size={16} color={DESIGN_TOKENS.colors.text} />
            <Text style={styles.backButtonText}>Назад</Text>
        </Pressable>
    ) : null;

    return (
        <View style={[styles.headerWrapper, isMobile && styles.headerWrapperMobile]}>
            <View style={[styles.headerRow, isMobile && styles.headerRowMobile]}>
                {BackButton}
                <View style={styles.titleColumn}>
                    {isMobile ? (
                        <>
                            <Text style={styles.headerTitleMobile} numberOfLines={1}>
                                {title}
                            </Text>
                            <Text style={styles.headerSubtitleMobile} numberOfLines={1}>
                                {subtitle}
                            </Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.headerTitle} numberOfLines={1}>
                                {title}
                            </Text>
                            <Text style={styles.headerSubtitle} numberOfLines={1}>
                                {subtitle} • {clamped}% готово
                            </Text>
                        </>
                    )}
                </View>
                <View style={styles.headerRightRow}>
                    {TipTrigger}
                    {autosaveBadge ? <Text style={styles.autosaveBadge}>{autosaveBadge}</Text> : null}
                </View>
            </View>

            <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${clamped}%`, backgroundColor: progressColor }]} />
            </View>

            {hasTip && isTipOpen ? (
                <View style={styles.tipPanel}>
                    <Text style={styles.tipPanelTitle}>{resolvedTipTitle}</Text>
                    <Text style={styles.tipPanelBody}>{tipBody}</Text>
                </View>
            ) : null}

            {extraBelowProgress}
        </View>
    );
};

const styles = StyleSheet.create({
    headerWrapper: {
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingTop: DESIGN_TOKENS.spacing.sm,
        paddingBottom: DESIGN_TOKENS.spacing.sm,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: DESIGN_TOKENS.colors.borderLight,
    },
    headerWrapperMobile: {
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingTop: DESIGN_TOKENS.spacing.xs,
        paddingBottom: DESIGN_TOKENS.spacing.xs,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    headerRowMobile: {
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: DESIGN_TOKENS.spacing.xs,
    },
    headerRightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 34,
        paddingHorizontal: 10,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderLight,
    },
    backButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
    },
    titleColumn: {
        flex: 1,
        minWidth: 0,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
        marginBottom: 2,
    },
    headerTitleMobile: {
        fontSize: 16,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: 13,
        color: DESIGN_TOKENS.colors.textMuted,
        fontWeight: '500',
    },
    headerSubtitleMobile: {
        fontSize: 12,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    autosaveBadge: {
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xxs,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: DESIGN_TOKENS.colors.primarySoft,
    },
    mobileMetaRow: {
        marginTop: 0,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
    },
    autosaveBadgeText: {
        fontSize: 11,
        color: DESIGN_TOKENS.colors.primaryDark,
        fontWeight: '600',
    },
    tipToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        height: 32,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderLight,
    },
    tipToggleButtonActive: {
        backgroundColor: DESIGN_TOKENS.colors.primarySoft,
        borderColor: DESIGN_TOKENS.colors.primary,
    },
    tipToggleText: {
        fontSize: 12,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.textSubtle,
    },
    tipToggleTextActive: {
        color: DESIGN_TOKENS.colors.primary,
    },
    progressBarTrack: {
        marginTop: DESIGN_TOKENS.spacing.xs,
        width: '100%',
        height: 6,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: DESIGN_TOKENS.colors.borderLight,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: DESIGN_TOKENS.radii.pill,
    },
    tipPanel: {
        marginTop: DESIGN_TOKENS.spacing.sm,
        padding: DESIGN_TOKENS.spacing.sm,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderLight,
    },
    tipPanelTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
        marginBottom: 4,
    },
    tipPanelBody: {
        fontSize: 12,
        color: DESIGN_TOKENS.colors.textMuted,
        lineHeight: 16,
    },
});

export default React.memo(TravelWizardHeader);
