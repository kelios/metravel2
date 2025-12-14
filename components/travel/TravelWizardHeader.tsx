import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text, useWindowDimensions, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { DESIGN_TOKENS } from '@/constants/designSystem';

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
    const { width } = useWindowDimensions();
    const isMobile = width <= DESIGN_TOKENS.breakpoints.mobile;
    const clamped = Math.min(Math.max(progressPercent, 0), 100);

    const [isTipOpen, setIsTipOpen] = useState(false);
    const hasTip = !!tipBody && tipBody.trim().length > 0;
    const resolvedTipTitle = useMemo(() => tipTitle ?? 'Совет', [tipTitle]);

    const TipTrigger = hasTip ? (
        isMobile ? (
            <Pressable
                onPress={() => setIsTipOpen(v => !v)}
                style={[styles.tipIconButton, isTipOpen && styles.tipIconButtonActive]}
                accessibilityRole="button"
                accessibilityLabel={isTipOpen ? 'Скрыть совет' : 'Показать совет'}
            >
                <Feather
                    name="info"
                    size={16}
                    color={isTipOpen ? DESIGN_TOKENS.colors.primary : DESIGN_TOKENS.colors.textSubtle}
                />
            </Pressable>
        ) : (
            <Pressable
                onPress={() => setIsTipOpen(v => !v)}
                style={[styles.tipToggleButton, isTipOpen && styles.tipToggleButtonActive]}
                accessibilityRole="button"
                accessibilityLabel={isTipOpen ? 'Скрыть совет' : 'Показать совет'}
                {...Platform.select({ web: { cursor: 'pointer' } })}
            >
                <Feather
                    name="info"
                    size={16}
                    color={isTipOpen ? DESIGN_TOKENS.colors.primary : DESIGN_TOKENS.colors.textSubtle}
                />
                <Text style={[styles.tipToggleText, isTipOpen && styles.tipToggleTextActive]} numberOfLines={1}>
                    {resolvedTipTitle}
                </Text>
            </Pressable>
        )
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
                    <Text style={[styles.headerTitle, isMobile && styles.headerTitleMobile]} numberOfLines={2}>
                        {title}
                    </Text>
                    <Text style={[styles.headerSubtitle, isMobile && styles.headerSubtitleMobile]} numberOfLines={2}>
                        {subtitle}
                    </Text>
                </View>
                {!isMobile ? (
                    <View style={styles.headerRightRow}>
                        {TipTrigger}
                        {autosaveBadge ? (
                            <View style={styles.autosaveBadge}>
                                <Text style={styles.autosaveBadgeText}>{autosaveBadge}</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}
            </View>

            {isMobile && (autosaveBadge || TipTrigger) ? (
                <View style={styles.mobileMetaRow}>
                    {autosaveBadge ? (
                        <View style={styles.autosaveBadge}>
                            <Text style={styles.autosaveBadgeText}>{autosaveBadge}</Text>
                        </View>
                    ) : null}
                    {TipTrigger}
                </View>
            ) : null}

            <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${clamped}%` }]} />
            </View>
            {!isMobile && <Text style={styles.progressLabel}>Готово на {clamped}%</Text>}

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
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: DESIGN_TOKENS.colors.borderLight,
    },
    headerWrapperMobile: {
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingTop: 6,
        paddingBottom: 6,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: DESIGN_TOKENS.colors.borderLight,
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
        fontSize: 18,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
        marginBottom: 4,
    },
    headerTitleMobile: {
        fontSize: 17,
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: 12,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    headerSubtitleMobile: {
        fontSize: 12,
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
    tipIconButton: {
        width: 28,
        height: 28,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderLight,
    },
    tipIconButtonActive: {
        backgroundColor: DESIGN_TOKENS.colors.primarySoft,
        borderColor: DESIGN_TOKENS.colors.primary,
    },
    tipToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        height: 34,
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
        marginTop: 6,
        width: '100%',
        height: 4,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: DESIGN_TOKENS.colors.borderLight,
    },
    progressBarFill: {
        height: 4,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: DESIGN_TOKENS.colors.primary,
    },
    progressLabel: {
        marginTop: 6,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.textMuted,
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
